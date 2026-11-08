import { describe, expect, it } from 'vitest'
import { accountBalance, byCategory, byMonth, totals } from './reports'
import { cleanLabel, matchRule } from './rules'
import type { Account, Rule, Transaction } from '../data/types'

const acc = (id: string, currency: Account['currency'] = 'XPF', initialBalance = 0): Account => ({
  id, updatedAt: '', name: id, type: 'checking', institution: 'other', currency, initialBalance, fxFeePct: 0, color: '',
})
const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), updatedAt: '', date: '2026-11-01', type: 'expense', amount: 1000, accountId: 'bt', tags: [], ...p,
})
const accounts = new Map([['bt', acc('bt', 'XPF', 50000)], ['db', acc('db', 'EUR', 100)]])

describe('reports', () => {
  const txs = [
    tx({ amount: 3900, categoryId: 'tel' }),
    tx({ type: 'income', amount: 385000, categoryId: 'sal' }),
    tx({ accountId: 'db', amount: 8.38, categoryId: 'tel', date: '2026-10-15' }),
    tx({ type: 'transfer', amount: 41766, toAccountId: 'db', toAmount: 350 }),
    tx({ amount: 999, deleted: true }),
  ]
  it('computes balances including transfers', () => {
    expect(accountBalance(accounts.get('bt')!, txs)).toBe(50000 - 3900 + 385000 - 41766)
    expect(accountBalance(accounts.get('db')!, txs)).toBe(100 - 8.38 + 350)
  })
  it('ignores operations dated before the initial balance date', () => {
    const a = { ...acc('x', 'XPF', 1000), initialDate: '2026-11-01' }
    const list = [tx({ accountId: 'x', date: '2026-10-31', amount: 500 }), tx({ accountId: 'x', date: '2026-11-01', amount: 200 })]
    expect(accountBalance(a, list)).toBe(800)
  })
  it('totals in XPF excluding transfers', () => {
    expect(totals(txs, accounts, {})).toEqual({ income: 385000, expense: 4900, net: 380100 })
  })
  it('groups by category and month', () => {
    expect(byCategory(txs, accounts, {})).toEqual([{ categoryId: 'tel', total: 4900 }])
    expect(byMonth(txs, accounts, {}, ['2026-10', '2026-11'])).toEqual([
      { month: '2026-10', income: 0, expense: 1000 },
      { month: '2026-11', income: 385000, expense: 3900 },
    ])
  })
})

describe('rules', () => {
  const rules: Rule[] = [
    { id: '1', updatedAt: '', pattern: 'vini', categoryId: 'tel' },
    { id: '2', updatedAt: '', pattern: 'carrefour', categoryId: 'courses' },
    { id: '3', updatedAt: '', pattern: 'carrefour market essence', categoryId: 'carburant' },
  ]
  it('matches case/accent-insensitively, longest pattern first', () => {
    expect(matchRule('PRLV VINI ABONNEMENT', rules)?.categoryId).toBe('tel')
    expect(matchRule('CB CARREFOUR MARKET ESSENCE', rules)?.categoryId).toBe('carburant')
    expect(matchRule('Inconnu', rules)).toBeUndefined()
    const ora: Rule[] = [{ id: 'o', updatedAt: '', pattern: 'ora', categoryId: 'tel' }, { id: 'a', updatedAt: '', pattern: 'apple.com', categoryId: 'abo' }]
    expect(matchRule('PRLV VITI ORA', ora)?.categoryId).toBe('tel')
    expect(matchRule('CB DECORATION MAISON', ora)).toBeUndefined()
    expect(matchRule('APPLE.COM/BILL', ora)?.categoryId).toBe('abo')
  })
  it('cleans bank labels', () => {
    expect(cleanLabel('CB CARREFOUR ARUE 05/11')).toBe('Carrefour Arue')
    expect(cleanLabel('PRLV SEPA NETFLIX.COM')).toBe('Netflix.com')
    expect(cleanLabel('Boulangerie')).toBe('Boulangerie')
  })
})
