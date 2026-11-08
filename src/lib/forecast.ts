import type { Account, Loan, Planned, Subscription, Transaction, Trip } from '../data/types'
import { addInterval, addMonths, daysBetween, daysInMonth, monthKey, monthRange, occurrencesBetween, split, type ISODate } from './dates'
import { installmentsBetween } from './loans'
import { effectiveFee, toXPF, type Rates } from './money'
import { normalize } from './id'
import { paymentXPF, upcomingPayments } from './subscriptions'
import { signedXPF } from './reports'

/** Début de la période affichée : 1er janvier de (année en cours − visibleYears + 1). Avant : archives. */
export function archiveStart(today: ISODate, visibleYears = 2): ISODate {
  return `${split(today)[0] - Math.max(1, visibleYears) + 1}-01-01`
}

export function plannedOccurrences(p: Planned, from: ISODate, to: ISODate): ISODate[] {
  if (!p.active || p.deleted) return []
  const end = p.endDate && p.endDate < to ? p.endDate : to
  if (p.unit === 'once') return p.startDate >= from && p.startDate <= end ? [p.startDate] : []
  return occurrencesBetween(p.startDate, p.every, p.unit, from, end)
}

export interface RecurringCandidate {
  key: string
  name: string
  kind: 'income' | 'expense'
  amount: number
  day: number
  categoryId?: string
  accountId: string
  member?: string
  months: number
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Catégories du quotidien : jamais proposées comme prévision (elles relèvent des « dépenses courantes »). */
const EVERYDAY = new Set(['c-courses', 'c-restaurants', 'c-carburant', 'c-shopping', 'c-loisirs', 'c-divers'])

/**
 * Revenus / dépenses récurrents (même bénéficiaire, présent au moins 3 des 4 derniers mois complets),
 * hors abonnements, prêts et prévisions déjà suivis. Sert à proposer des prévisions en un clic.
 */
export function detectRecurring(txs: Transaction[], today: ISODate, accounts: Map<string, Account>, rates: Rates): RecurringCandidate[] {
  const thisMonth = monthKey(today)
  const months = [1, 2, 3, 4].map((i) => addMonths(thisMonth, -i))
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (t.deleted || t.type === 'transfer' || t.subscriptionId || t.loanId || t.plannedId || t.tripId) continue
    if (!months.includes(monthKey(t.date))) continue
    if (t.type === 'expense' && t.categoryId && EVERYDAY.has(t.categoryId)) continue
    const name = t.payee || t.rawLabel
    if (!name) continue
    const key = `${t.type}|${normalize(name)}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out: RecurringCandidate[] = []
  for (const [key, list] of groups) {
    const seen = new Set(list.map((t) => monthKey(t.date)))
    if (seen.size < 3) continue
    const perMonth = [...seen].map((m) => list.filter((t) => monthKey(t.date) === m).reduce((s, t) => s + Math.abs(signedXPF(t, accounts, rates)), 0))
    // Montant régulier (±25 % autour de la médiane) : un salaire ou une pension, pas des achats au fil de l'eau.
    const med = median(perMonth)
    if (perMonth.some((v) => Math.abs(v - med) > med * 0.25)) continue
    const last = list.sort((a, b) => b.date.localeCompare(a.date))[0]
    out.push({
      key, name: last.payee || last.rawLabel || '', kind: last.type as 'income' | 'expense', amount: median(perMonth),
      day: median(list.map((t) => split(t.date)[2])), categoryId: last.categoryId, accountId: last.accountId, member: last.member, months: seen.size,
    })
  }
  return out.sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind === 'income' ? -1 : 1))
}

/** Dépenses courantes : moyenne des 3 derniers mois complets, hors abonnements, prêts, prévisions, voyages et virements. */
export function estimateVariable(txs: Transaction[], today: ISODate, accounts: Map<string, Account>, rates: Rates, excludedCategories: Set<string>): number {
  const months = [1, 2, 3].map((i) => addMonths(monthKey(today), -i))
  let total = 0
  for (const t of txs) {
    if (t.deleted || t.type !== 'expense' || t.subscriptionId || t.loanId || t.plannedId || t.tripId) continue
    if (t.categoryId && excludedCategories.has(t.categoryId)) continue
    if (!months.includes(monthKey(t.date))) continue
    total += -signedXPF(t, accounts, rates)
  }
  return Math.round(total / 3)
}

export interface TripStatus {
  budget: number
  spent: number
  remaining: number
  saved: number
  toSave: number
  daysToGo: number
  monthsToGo: number
  perMonth: number
  phase: 'avant' | 'pendant' | 'après'
}

/** Budget du voyage (XPF), dépensé (opérations rattachées), épargne restante à constituer par mois. */
export function tripStatus(trip: Trip, txs: Transaction[], accounts: Map<string, Account>, rates: Rates, today: ISODate, savedXPF = 0): TripStatus {
  const budget = trip.budgetLines.reduce((s, l) => s + toXPF(l.amount, l.currency, rates), 0)
  const spent = txs.filter((t) => t.tripId === trip.id && !t.deleted && t.type === 'expense').reduce((s, t) => s - signedXPF(t, accounts, rates), 0)
  const remaining = Math.max(0, budget - spent)
  const daysToGo = Math.max(0, daysBetween(today, trip.startDate))
  const [ty, tm] = split(today)
  const [sy, sm] = split(trip.startDate)
  const monthsToGo = Math.max(0, (sy - ty) * 12 + (sm - tm))
  const toSave = Math.max(0, remaining - savedXPF)
  return {
    budget, spent, remaining, saved: savedXPF, toSave, daysToGo, monthsToGo,
    perMonth: monthsToGo > 0 ? Math.ceil(toSave / monthsToGo) : toSave,
    phase: today < trip.startDate ? 'avant' : today <= trip.endDate ? 'pendant' : 'après',
  }
}

export interface ForecastMonth {
  month: string
  income: number
  subscriptions: number
  loans: number
  planned: number
  trips: number
  variable: number
  net: number
  endBalance: number
}

export interface ForecastInput {
  today: ISODate
  months: number
  startBalance: number
  rates: Rates
  accounts: Map<string, Account>
  subscriptions: Subscription[]
  loans: Loan[]
  planned: Planned[]
  trips: Trip[]
  tripSpent: (trip: Trip) => number
  variableMonthly: number
}

/** Projection mois par mois du solde (XPF), à partir de demain. */
export function forecast(inp: ForecastInput): ForecastMonth[] {
  const out: ForecastMonth[] = []
  let balance = inp.startBalance
  const first = monthKey(inp.today)
  // Dépenses de voyage restantes réparties sur les jours du voyage (à partir de demain).
  const tripDaily = inp.trips.filter((t) => !t.deleted).map((t) => {
    const budget = t.budgetLines.reduce((s, l) => s + toXPF(l.amount, l.currency, inp.rates), 0)
    const remaining = Math.max(0, budget - inp.tripSpent(t))
    const start = t.startDate > inp.today ? t.startDate : nextDay(inp.today)
    const days = daysBetween(start, t.endDate) + 1
    return { start, end: t.endDate, perDay: days > 0 ? remaining / days : 0 }
  })
  for (let i = 0; i < inp.months; i++) {
    const month = addMonths(first, i)
    const [mStart, mEnd] = monthRange(month)
    const from = i === 0 ? nextDay(inp.today) : mStart
    let income = 0
    let plannedOut = 0
    for (const p of inp.planned) {
      const n = plannedOccurrences(p, from, mEnd).length
      if (!n) continue
      const acc = inp.accounts.get(p.accountId ?? '')
      const v = n * toXPF(p.amount, p.currency, inp.rates) * (1 + effectiveFee(p.currency, acc?.currency, acc?.fxFeePct) / 100)
      if (p.kind === 'income') income += v
      else plannedOut += v
    }
    const subs = upcomingPayments(inp.subscriptions, from, mEnd).reduce((s, u) => {
      const acc = inp.accounts.get(u.sub.accountId ?? '')
      return s + paymentXPF(u.sub, inp.rates, effectiveFee(u.sub.currency, acc?.currency, acc?.fxFeePct))
    }, 0)
    const loans = inp.loans.reduce((s, l) => s + installmentsBetween(l, from, mEnd).reduce((a, r) => a + toXPF(r.total, l.currency, inp.rates), 0), 0)
    let trips = 0
    for (const td of tripDaily) {
      const a = td.start > from ? td.start : from
      const b = td.end < mEnd ? td.end : mEnd
      if (a <= b) trips += (daysBetween(a, b) + 1) * td.perDay
    }
    const [y, m] = month.split('-').map(Number)
    const share = i === 0 ? (daysBetween(inp.today, mEnd)) / daysInMonth(y, m) : 1
    const variable = inp.variableMonthly * share
    const r = (n: number) => Math.round(n)
    const row = { month, income: r(income), subscriptions: r(subs), loans: r(loans), planned: r(plannedOut), trips: r(trips), variable: r(variable) }
    const net = row.income - row.subscriptions - row.loans - row.planned - row.trips - row.variable
    balance += net
    out.push({ ...row, net, endBalance: balance })
  }
  return out
}

function nextDay(d: ISODate): ISODate {
  return addInterval(d, 1, 'day')
}
