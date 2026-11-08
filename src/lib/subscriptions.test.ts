import { describe, expect, it } from 'vitest'
import { monthlyCost, nextPayment, upcomingPayments, yearlyCost, costByTag, dueForPayment } from './subscriptions'
import type { Subscription } from '../data/types'

const base = (p: Partial<Subscription>): Subscription => ({
  id: p.name ?? 'x', updatedAt: '', name: 'X', amount: 1000, currency: 'XPF', every: 1, unit: 'month',
  startDate: '2026-01-01', status: 'active', tags: [], color: '#000', remindDays: 2, ...p,
})
const rates = { USD: 110 }

describe('subscriptions', () => {
  it('normalises cost per month and per year', () => {
    expect(monthlyCost(base({ amount: 12000, unit: 'year' }), rates)).toBe(1000)
    expect(monthlyCost(base({ amount: 3900 }), rates)).toBe(3900)
    expect(monthlyCost(base({ amount: 1000, unit: 'week' }), rates)).toBe(4348)
    expect(monthlyCost(base({ amount: 8.38, currency: 'EUR' }), rates)).toBe(1000)
    expect(yearlyCost(base({ amount: 1000, every: 3 }), rates)).toBe(4000)
  })
  it('adds account FX fee for foreign currencies', () => {
    expect(monthlyCost(base({ amount: 10, currency: 'USD' }), rates, 2.5)).toBe(1128)
    expect(monthlyCost(base({ amount: 1000 }), rates, 2.5)).toBe(1000)
  })
  it('ignores paused and cancelled subscriptions in costs', () => {
    expect(monthlyCost(base({ status: 'paused' }), rates)).toBe(0)
    expect(monthlyCost(base({ status: 'cancelled' }), rates)).toBe(0)
  })
  it('computes next payment, honouring trial end', () => {
    expect(nextPayment(base({ startDate: '2025-11-26' }), '2026-11-08')).toBe('2026-11-26')
    expect(nextPayment(base({ startDate: '2026-01-01', trialEnd: '2026-12-15', status: 'trial' }), '2026-11-08')).toBe('2026-12-15')
    expect(nextPayment(base({ status: 'cancelled' }), '2026-11-08')).toBeNull()
  })
  it('starts after the last paid date', () => {
    expect(nextPayment(base({ startDate: '2025-11-08', lastPaidDate: '2026-11-08' }), '2026-11-08')).toBe('2026-12-08')
  })
  it('lists upcoming payments sorted by date', () => {
    const subs = [base({ name: 'B', startDate: '2026-01-20' }), base({ name: 'A', startDate: '2026-01-10' })]
    const up = upcomingPayments(subs, '2026-11-08', '2026-12-31')
    expect(up.map((u) => `${u.sub.name} ${u.date}`)).toEqual(['A 2026-11-10', 'B 2026-11-20', 'A 2026-12-10', 'B 2026-12-20'])
  })
  it('lists unpaid past occurrences as due', () => {
    const s = base({ startDate: '2026-09-05', lastPaidDate: '2026-09-05' })
    expect(dueForPayment(s, '2026-11-08')).toEqual(['2026-10-05', '2026-11-05'])
  })
  it('groups monthly cost by tag', () => {
    const subs = [base({ name: 'Netflix', tags: ['Streaming'] }), base({ name: 'Spotify', tags: ['Streaming', 'Musique'] }), base({ name: 'Vini', tags: [] })]
    expect(costByTag(subs, rates)).toEqual([
      { tag: 'Streaming', count: 2, monthly: 2000 },
      { tag: 'Musique', count: 1, monthly: 1000 },
      { tag: 'Sans étiquette', count: 1, monthly: 1000 },
    ])
  })
})
