import { describe, expect, it } from 'vitest'
import { entryWarnings } from './checks'
import { DEFAULT_RATES } from './money'

const w = (amount: number, currency: 'XPF' | 'EUR' | 'USD', date: string) => entryWarnings({ amount, currency, date, today: '2026-11-13', rates: DEFAULT_RATES })

describe('recette R6 — alertes avant d’enregistrer', () => {
  it('montant inhabituel (≥ 1 000 000 F, toutes devises converties)', () => {
    expect(w(12000, 'XPF', '2026-11-13')).toEqual([])
    expect(w(999_999, 'XPF', '2026-11-13')).toEqual([])
    expect(w(1_000_000, 'XPF', '2026-11-13')[0]).toMatch(/inhabituel/)
    expect(w(9000, 'EUR', '2026-11-13')[0]).toMatch(/inhabituel/) // ≈ 1 074 000 F
    expect(w(5000, 'EUR', '2026-11-13')).toEqual([])
  })
  it('date dans le futur', () => {
    expect(w(100, 'XPF', '2026-11-14')).toEqual(['La date est dans le futur : 14/11/2026.'])
    expect(w(100, 'XPF', '2026-11-12')).toEqual([])
    expect(w(2_000_000, 'XPF', '2027-03-15')).toHaveLength(2)
  })
})
