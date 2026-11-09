import { describe, expect, it } from 'vitest'
import { findManualMatch } from './reconcile'
import { parseReceipt } from './receipt'
import type { Transaction } from '../data/types'

const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), updatedAt: '', date: '2026-11-02', type: 'expense', amount: 2890, accountId: 'bt', tags: [], ...p })

describe('rapprochement', () => {
  const manual = [
    tx({ id: 'fournil', payee: 'Le Fournil', amount: 2890, date: '2026-11-02' }),
    tx({ id: 'usd', payee: 'Target', amount: 5600, date: '2026-11-03', originalAmount: 50, originalCurrency: 'USD' }),
    tx({ id: 'deja', amount: 1000, date: '2026-11-02', importHash: 'x' }),
    tx({ id: 'autre-compte', amount: 4615, accountId: 'amex', date: '2026-11-02' }),
  ]
  it('matches a manual entry posted a few days later by the bank', () => {
    expect(findManualMatch({ date: '2026-11-06', amount: -2890 }, 'bt', manual, new Set())?.id).toBe('fournil')
  })
  it('tolerates FX differences for foreign purchases', () => {
    expect(findManualMatch({ date: '2026-11-05', amount: -5712 }, 'bt', manual, new Set())?.id).toBe('usd')
  })
  it('ignores already imported, other accounts, used, out of window or different amounts', () => {
    expect(findManualMatch({ date: '2026-11-02', amount: -1000 }, 'bt', manual, new Set())).toBeUndefined()
    expect(findManualMatch({ date: '2026-11-02', amount: -4615 }, 'bt', manual, new Set())).toBeUndefined()
    expect(findManualMatch({ date: '2026-11-06', amount: -2890 }, 'bt', manual, new Set(['fournil']))).toBeUndefined()
    expect(findManualMatch({ date: '2026-11-20', amount: -2890 }, 'bt', manual, new Set())).toBeUndefined()
    expect(findManualMatch({ date: '2026-11-06', amount: -2990 }, 'bt', manual, new Set())).toBeUndefined()
  })
})

describe('tickets de caisse', () => {
  it('reads a French receipt', () => {
    const r = parseReceipt(`CARREFOUR ARUE\nRoute de ceinture\nTICKET N 1234\nPAIN 350\nLAIT 290\nSOUS-TOTAL 640\nTOTAL TTC 12 450 XPF\nCB 12 450\n05/11/2026 10:32`)
    expect(r).toMatchObject({ merchant: 'CARREFOUR ARUE', amount: 12450, currency: 'XPF', date: '2026-11-05' })
  })
  it('reads a US receipt in dollars', () => {
    const r = parseReceipt(`WALMART SUPERCENTER\n2201 W 3RD ST\nSUBTOTAL 45.10\nTAX 3.61\nTOTAL $48.71\nVISA TEND 48.71\n11/03/26 14:22`)
    expect(r).toMatchObject({ merchant: 'WALMART SUPERCENTER', amount: 48.71, currency: 'USD', date: '2026-11-03' })
  })
  it('reads a euro receipt', () => {
    const r = parseReceipt(`Bienvenue\nMONOPRIX OPERA\nArticles 3\nMONTANT A PAYER 23,90 €\n12.07.2027`)
    expect(r).toMatchObject({ merchant: 'MONOPRIX OPERA', amount: 23.9, currency: 'EUR', date: '2027-07-12' })
  })
})
