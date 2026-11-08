import { describe, expect, it } from 'vitest'
import { archiveStart, detectRecurring, forecast, plannedOccurrences, tripStatus, estimateVariable } from './forecast'
import type { Account, Loan, Planned, Subscription, Transaction, Trip } from '../data/types'

const acc: Account = { id: 'bt', updatedAt: '', name: 'BT', type: 'checking', institution: 'banque-de-tahiti', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '' }
const accounts = new Map([['bt', acc]])
const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), updatedAt: '', date: '2026-10-01', type: 'expense', amount: 1000, accountId: 'bt', tags: [], ...p })
const planned = (p: Partial<Planned>): Planned => ({ id: 'p', updatedAt: '', name: 'Salaire', kind: 'income', amount: 500000, currency: 'XPF', unit: 'month', every: 1, startDate: '2026-01-25', active: true, ...p })

describe('archive', () => {
  it('keeps the current and previous year visible by default', () => {
    expect(archiveStart('2026-11-08')).toBe('2025-01-01')
    expect(archiveStart('2027-01-02')).toBe('2026-01-01')
    expect(archiveStart('2026-11-08', 3)).toBe('2024-01-01')
  })
})

describe('planned', () => {
  it('lists recurring, one-off and ended occurrences', () => {
    expect(plannedOccurrences(planned({}), '2026-11-08', '2027-01-31')).toEqual(['2026-11-25', '2026-12-25', '2027-01-25'])
    expect(plannedOccurrences(planned({ unit: 'once', startDate: '2026-12-15' }), '2026-11-08', '2027-01-31')).toEqual(['2026-12-15'])
    expect(plannedOccurrences(planned({ endDate: '2026-12-31' }), '2026-11-08', '2027-01-31')).toEqual(['2026-11-25', '2026-12-25'])
    expect(plannedOccurrences(planned({ active: false }), '2026-11-08', '2027-01-31')).toEqual([])
  })
})

describe('recurring detection', () => {
  it('suggests incomes and expenses seen in 3 of the last 4 months', () => {
    const txs = [
      ...['2026-07-28', '2026-08-26', '2026-09-28', '2026-10-26'].map((d, i) => tx({ date: d, type: 'income', amount: 550000 + i * 1000, payee: 'Anset Assurances' })),
      ...['2026-08-05', '2026-09-05', '2026-10-05'].map((d) => tx({ date: d, amount: 90000, payee: 'Pension', categoryId: 'c-pension' })),
      tx({ date: '2026-10-12', amount: 5000, payee: 'Resto' }),
      ...['2026-08-12', '2026-09-12', '2026-10-12'].map((d) => tx({ date: d, amount: 25000, payee: 'Carrefour', categoryId: 'c-courses' })),
      ...[['2026-08-03', 20000], ['2026-09-03', 60000], ['2026-10-03', 35000]].map(([d, a]) => tx({ date: d as string, amount: a as number, payee: 'Garage' })),
      ...['2026-08-05', '2026-09-05', '2026-10-05'].map((d) => tx({ date: d, amount: 61109, payee: 'Prêt', loanId: 'l1' })),
    ]
    const r = detectRecurring(txs, '2026-11-08', accounts, {})
    expect(r.map((x) => [x.name, x.kind, x.amount, x.day])).toEqual([
      ['Anset Assurances', 'income', 551500, 27],
      ['Pension', 'expense', 90000, 5],
    ])
  })
})

describe('trips', () => {
  const trip: Trip = {
    id: 't', updatedAt: '', name: 'France', startDate: '2027-07-01', endDate: '2027-07-31', color: '', savingsAccountId: 'db',
    budgetLines: [{ id: 'a', label: 'Billets', amount: 400000, currency: 'XPF' }, { id: 'b', label: 'Hébergement', amount: 1000, currency: 'EUR' }],
  }
  it('computes budget, spent, savings need per month', () => {
    const st = tripStatus(trip, [tx({ tripId: 't', amount: 150000 })], accounts, {}, '2026-11-08', 200000)
    expect(st.budget).toBe(400000 + 119332)
    expect(st.spent).toBe(150000)
    expect(st.remaining).toBe(369332)
    expect(st.daysToGo).toBe(235)
    expect(st.monthsToGo).toBe(8)
    expect(st.toSave).toBe(169332)
    expect(st.perMonth).toBe(21167)
  })
})

describe('forecast', () => {
  it('projects month-end balances with all known flows', () => {
    const subs: Subscription[] = [{ id: 's', updatedAt: '', name: 'Vini', amount: 3900, currency: 'XPF', every: 1, unit: 'month', startDate: '2026-01-20', status: 'active', tags: [], color: '', remindDays: 0 }]
    const loans: Loan[] = [{ id: 'l', updatedAt: '', name: 'Jeep', principal: 1_200_000, currency: 'XPF', annualRate: 0, termMonths: 12, startDate: '2026-06-10', insuranceMonthly: 0, extraRepayments: [], color: '' }]
    const f = forecast({
      today: '2026-11-08', months: 3, startBalance: 1_000_000, rates: {}, accounts,
      subscriptions: subs, loans, planned: [planned({}), planned({ id: 'x', name: 'Impôt', kind: 'expense', unit: 'once', startDate: '2026-12-10', amount: 80000 })],
      trips: [], tripSpent: () => 0, variableMonthly: 300000,
    })
    expect(f.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    // novembre : il reste 22 jours sur 30 après aujourd'hui pour les dépenses courantes
    expect(f[0]).toMatchObject({ income: 500000, subscriptions: 3900, loans: 100000, planned: 0, variable: 220000 })
    expect(f[0].endBalance).toBe(1_000_000 + 500000 - 3900 - 100000 - 220000)
    expect(f[1]).toMatchObject({ planned: 80000, variable: 300000 })
    expect(f[2].endBalance).toBe(f[1].endBalance + 500000 - 3900 - 100000 - 300000)
  })
  it('spreads remaining trip budget over the trip days', () => {
    const trip: Trip = { id: 't', updatedAt: '', name: 'Moorea', startDate: '2026-12-30', endDate: '2027-01-02', color: '', budgetLines: [{ id: 'a', label: 'Tout', amount: 40000, currency: 'XPF' }] }
    const f = forecast({ today: '2026-11-08', months: 3, startBalance: 0, rates: {}, accounts, subscriptions: [], loans: [], planned: [], trips: [trip], tripSpent: () => 0, variableMonthly: 0 })
    expect(f.map((m) => m.trips)).toEqual([0, 20000, 20000])
  })
  it('estimates everyday spending excluding scheduled items', () => {
    const txs = [
      tx({ date: '2026-08-10', amount: 300000 }), tx({ date: '2026-09-10', amount: 330000 }), tx({ date: '2026-10-10', amount: 360000 }),
      tx({ date: '2026-10-05', amount: 61109, loanId: 'l' }), tx({ date: '2026-10-07', amount: 3900, subscriptionId: 's' }),
      tx({ date: '2026-10-08', amount: 90000, categoryId: 'c-pension' }), tx({ date: '2026-11-02', amount: 999999 }),
      tx({ date: '2026-10-09', type: 'transfer', amount: 50000, toAccountId: 'db' }),
    ]
    expect(estimateVariable(txs, '2026-11-08', accounts, {}, new Set(['c-pension']))).toBe(330000)
  })
})
