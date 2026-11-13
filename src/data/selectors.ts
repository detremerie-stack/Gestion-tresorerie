/**
 * Sélecteurs partagés (accueil, abonnements, PC) : calculs purs, testés, sans React.
 * Ils reprennent à l'identique les calculs qui étaient écrits dans `Dashboard.tsx` (v1).
 */
import type { Account, Loan, Subscription, Transaction } from './types'
import { addInterval, monthKey, type ISODate } from '../lib/dates'
import { dueForPayment, isExact, paymentXPF, upcomingPayments } from '../lib/subscriptions'
import { dueInstallments, installmentsBetween, type Installment } from '../lib/loans'
import { effectiveFee, isFixedRate, toXPF, type Rates } from '../lib/money'
import { byCategory, totals } from '../lib/reports'

/** Échéance passée et pas encore confirmée (« C'est passé ? »). */
export interface DueItem {
  key: string
  kind: 'subscription' | 'loan'
  id: string
  name: string
  date: ISODate
  color: string
  to: string
  installment?: Installment
}

/** Prélèvement à venir (abonnement ou mensualité de crédit), en XPF. */
export interface UpcomingItem {
  key: string
  kind: 'subscription' | 'loan'
  id: string
  name: string
  date: ISODate
  xpf: number
  approx: boolean
  color: string
  to: string
  remind: number
}

/** À confirmer : abonnements et mensualités passés non encore enregistrés, du plus ancien au plus récent. */
export function dueItems(subs: Subscription[], loans: Loan[], today: ISODate): DueItem[] {
  const s: DueItem[] = subs.flatMap((sub) => dueForPayment(sub, today).map((date) => ({
    key: sub.id + date, kind: 'subscription' as const, id: sub.id, name: sub.name, date, color: sub.color, to: `/abonnements/${sub.id}`,
  })))
  const l: DueItem[] = loans.flatMap((loan) => dueInstallments(loan, today).map((inst) => ({
    key: loan.id + inst.date, kind: 'loan' as const, id: loan.id, name: `${loan.name} · mensualité ${inst.n}`, date: inst.date, color: loan.color, to: `/prets/${loan.id}`, installment: inst,
  })))
  return [...s, ...l].sort((a, b) => a.date.localeCompare(b.date))
}

/** À payer entre `from` et `to` (inclus), triés par date puis nom. */
export function upcomingItems(subs: Subscription[], loans: Loan[], accounts: Map<string, Account>, rates: Rates, from: ISODate, to: ISODate): UpcomingItem[] {
  const s: UpcomingItem[] = upcomingPayments(subs, from, to).map(({ sub, date }) => {
    const acc = accounts.get(sub.accountId ?? '')
    const fee = effectiveFee(sub.currency, acc?.currency, acc?.fxFeePct)
    return { key: sub.id + date, kind: 'subscription' as const, id: sub.id, name: sub.name, date, xpf: paymentXPF(sub, rates, fee), approx: !isExact(sub, fee), color: sub.color, to: `/abonnements/${sub.id}`, remind: sub.remindDays }
  })
  const l: UpcomingItem[] = loans.flatMap((loan) => installmentsBetween(loan, from, to).map((inst) => ({
    key: loan.id + inst.date, kind: 'loan' as const, id: loan.id, name: `${loan.name} · mensualité`, date: inst.date, xpf: toXPF(inst.total, loan.currency, rates), approx: !isFixedRate(loan.currency),
    color: loan.color, to: `/prets/${loan.id}`, remind: 3,
  })))
  return [...s, ...l].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

/** Bloc « À confirmer et à payer d'ici N jours » : d'abord les passés à confirmer, puis demain → J+N ; `max` lignes. */
export function agenda(subs: Subscription[], loans: Loan[], accounts: Map<string, Account>, rates: Rates, today: ISODate, days = 7, max = 5) {
  const due = dueItems(subs, loans, today)
  const upcoming = upcomingItems(subs, loans, accounts, rates, addInterval(today, 1, 'day'), addInterval(today, days, 'day'))
  const rows: ({ type: 'due' } & DueItem | { type: 'upcoming' } & UpcomingItem)[] = [
    ...due.map((d) => ({ type: 'due' as const, ...d })),
    ...upcoming.map((u) => ({ type: 'upcoming' as const, ...u })),
  ]
  return { rows: rows.slice(0, max), total: rows.length, until: addInterval(today, days, 'day') }
}

/** Dernières opérations (hors virements entre comptes), plus récentes d'abord. */
export function recentTransactions(txs: Transaction[], n: number): Transaction[] {
  return txs.filter((x) => !x.deleted && x.type !== 'transfer').sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, n)
}

/** Totaux d'un mois (XPF) : dépensé / reçu et dépenses par catégorie (plus grosses d'abord). */
export function monthSummary(txs: Transaction[], month: string, accounts: Map<string, Account>, rates: Rates) {
  const monthTxs = txs.filter((x) => !x.deleted && monthKey(x.date) === month)
  return { totals: totals(monthTxs, accounts, rates), categories: byCategory(monthTxs, accounts, rates) }
}
