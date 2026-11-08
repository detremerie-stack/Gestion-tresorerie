import { describe, expect, it } from 'vitest'
import { loanStatus, monthlyPayment, schedule } from './loans'
import type { Loan } from '../data/types'

const loan = (p: Partial<Loan> = {}): Loan => ({
  id: 'l', updatedAt: '', name: 'Maison', principal: 10_000_000, currency: 'XPF', annualRate: 3, termMonths: 240,
  startDate: '2025-01-05', insuranceMonthly: 0, extraRepayments: [], color: '#000', ...p,
})

describe('loans', () => {
  it('computes the constant monthly payment', () => {
    expect(monthlyPayment(10_000_000, 3, 240, 'XPF')).toBe(55460)
    expect(monthlyPayment(1_200_000, 0, 12, 'XPF')).toBe(100000)
    expect(monthlyPayment(20000, 4.5, 60, 'EUR')).toBe(372.86)
  })
  it('builds an amortization schedule that repays the principal exactly', () => {
    const s = schedule(loan())
    expect(s).toHaveLength(240)
    expect(s[0]).toMatchObject({ date: '2025-01-05', interest: 25000, principal: 30460, payment: 55460, remaining: 9_969_540 })
    expect(s[1].date).toBe('2025-02-05')
    expect(s.at(-1)!.remaining).toBe(0)
    expect(s.reduce((a, r) => a + r.principal, 0)).toBe(10_000_000)
    expect(s.at(-1)!.date).toBe('2044-12-05')
  })
  it('adds borrower insurance to each installment', () => {
    const s = schedule(loan({ insuranceMonthly: 2500 }))
    expect(s[0].total).toBe(57960)
    expect(s[0].insurance).toBe(2500)
  })
  it('shortens the loan after an early repayment, keeping the same installment', () => {
    const base = schedule(loan())
    const s = schedule(loan({ extraRepayments: [{ date: '2026-01-20', amount: 2_000_000 }] }))
    expect(s.length).toBeLessThan(base.length)
    expect(s.find((r) => r.extra)?.date).toBe('2026-02-05')
    expect(s.at(-1)!.remaining).toBe(0)
    const repaid = s.reduce((a, r) => a + r.principal + (r.extra ?? 0), 0)
    expect(repaid).toBe(10_000_000)
  })
  it('reports progress at a given date', () => {
    const st = loanStatus(loan(), '2026-11-08')
    // échéances payées : janv. 2025 → nov. 2026 = 23
    expect(st.paidCount).toBe(23)
    expect(st.nextDate).toBe('2026-12-05')
    expect(st.remaining).toBe(schedule(loan())[22].remaining)
    expect(st.endDate).toBe('2044-12-05')
    expect(st.totalInterest).toBe(schedule(loan()).reduce((a, r) => a + r.interest, 0))
    expect(st.progress).toBeGreaterThan(0.07)
    expect(st.progress).toBeLessThan(0.08)
  })
  it('handles a loan that has not started or is finished', () => {
    expect(loanStatus(loan({ startDate: '2027-01-05' }), '2026-11-08').paidCount).toBe(0)
    const done = loanStatus(loan({ termMonths: 12, principal: 120000, startDate: '2024-01-01' }), '2026-11-08')
    expect(done.remaining).toBe(0)
    expect(done.nextDate).toBeNull()
  })
})
