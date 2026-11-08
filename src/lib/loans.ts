import type { Loan } from '../data/types'
import { nthOccurrence, type ISODate } from './dates'
import { roundTo, type Currency } from './money'

export interface Installment {
  /** Numéro d'échéance (1 = première). */
  n: number
  date: ISODate
  /** Mensualité hors assurance (intérêts + capital). */
  payment: number
  interest: number
  principal: number
  insurance: number
  /** Mensualité assurance comprise. */
  total: number
  /** Remboursement anticipé appliqué juste avant cette échéance. */
  extra?: number
  /** Capital restant dû après l'échéance. */
  remaining: number
}

/** Mensualité constante (prêt amortissable classique), arrondie selon la devise. */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number, currency: Currency): number {
  if (termMonths <= 0) return 0
  const r = annualRate / 100 / 12
  const raw = r === 0 ? principal / termMonths : (principal * r) / (1 - (1 + r) ** -termMonths)
  return roundTo(raw, currency)
}

/** Tableau d'amortissement complet, remboursements anticipés compris. */
export function schedule(loan: Loan): Installment[] {
  const cur = loan.currency
  const r = loan.annualRate / 100 / 12
  const payment = monthlyPayment(loan.principal, loan.annualRate, loan.termMonths, cur)
  const extras = [...(loan.extraRepayments ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const out: Installment[] = []
  let remaining = loan.principal
  let prev = ''
  for (let k = 0; remaining > 0 && k < loan.termMonths + 600; k++) {
    const date = nthOccurrence(loan.startDate, 1, 'month', k)
    // Remboursements anticipés intervenus depuis l'échéance précédente.
    let extra = 0
    for (const e of extras) if (e.date > prev && e.date <= date) extra += e.amount
    extra = Math.min(extra, remaining)
    remaining = roundTo(remaining - extra, cur)
    if (remaining <= 0) {
      out.push({ n: k + 1, date, payment: 0, interest: 0, principal: 0, insurance: 0, total: 0, extra, remaining: 0 })
      break
    }
    const interest = roundTo(remaining * r, cur)
    let principal = roundTo(payment - interest, cur)
    // Dernière échéance : elle solde le capital (absorbe les écarts d'arrondi).
    if (principal >= remaining || k >= loan.termMonths - 1) principal = remaining
    remaining = roundTo(remaining - principal, cur)
    const pay = roundTo(interest + principal, cur)
    out.push({
      n: k + 1, date, payment: pay, interest, principal, insurance: loan.insuranceMonthly,
      total: roundTo(pay + loan.insuranceMonthly, cur), ...(extra ? { extra } : {}), remaining,
    })
    prev = date
  }
  return out
}

export interface LoanStatus {
  payment: number
  paidCount: number
  totalCount: number
  remaining: number
  nextDate: ISODate | null
  next?: Installment
  endDate: ISODate | null
  totalInterest: number
  interestPaid: number
  totalInsurance: number
  /** Part du capital remboursée (0 → 1). */
  progress: number
}

export function loanStatus(loan: Loan, today: ISODate): LoanStatus {
  const s = schedule(loan)
  const paid = s.filter((r) => r.date <= today)
  const next = s.find((r) => r.date > today && r.total > 0)
  const remaining = paid.length ? paid[paid.length - 1].remaining : loan.principal
  return {
    payment: monthlyPayment(loan.principal, loan.annualRate, loan.termMonths, loan.currency),
    paidCount: paid.length,
    totalCount: s.length,
    remaining,
    nextDate: next?.date ?? null,
    next,
    endDate: s.length ? s[s.length - 1].date : null,
    totalInterest: s.reduce((a, r) => a + r.interest, 0),
    interestPaid: paid.reduce((a, r) => a + r.interest, 0),
    totalInsurance: s.reduce((a, r) => a + r.insurance, 0),
    progress: loan.principal ? (loan.principal - remaining) / loan.principal : 0,
  }
}

/** Échéances entre deux dates (incluses). */
export function installmentsBetween(loan: Loan, from: ISODate, to: ISODate): Installment[] {
  return schedule(loan).filter((r) => r.date >= from && r.date <= to && r.total > 0)
}

/** Échéances passées non encore enregistrées dans les opérations (max 12). */
export function dueInstallments(loan: Loan, today: ISODate): Installment[] {
  if (loan.deleted) return []
  return schedule(loan)
    .filter((r) => r.date <= today && r.total > 0 && (!loan.lastPaidDate || r.date > loan.lastPaidDate))
    .slice(-12)
}

/** « 14 ans 4 mois » */
export function durationLabel(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} an${y > 1 ? 's' : ''}` : '', m ? `${m} mois` : ''].filter(Boolean).join(' ') || '0 mois'
}
