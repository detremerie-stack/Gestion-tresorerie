import { describe, expect, it } from 'vitest'
import fixture from '../test/fixture-sauvegarde.json'
import type { Account, Loan, Planned, Subscription, Transaction, Trip } from './types'
import { agenda, dueItems, monthSummary, recentTransactions, upcomingItems } from './selectors'
import { addInterval, monthKey } from '../lib/dates'
import { dueForPayment, isExact, paymentXPF, upcomingPayments } from '../lib/subscriptions'
import { dueInstallments, installmentsBetween } from '../lib/loans'
import { DEFAULT_RATES, effectiveFee, isFixedRate, toXPF } from '../lib/money'
import { accountBalance, byCategory, totals } from '../lib/reports'
import { endOfMonth, forecast, perDay } from '../lib/forecast'

const D = fixture.data as unknown as Record<string, Record<string, unknown>>
const list = <T,>(k: string) => Object.values(D[k] ?? {}).filter((x) => !(x as { deleted?: boolean }).deleted) as T[]
const T = '2026-11-13'
const rates = DEFAULT_RATES
const accounts = new Map(list<Account>('accounts').map((a) => [a.id, a]))
const txs = list<Transaction>('transactions')
const subs = list<Subscription>('subscriptions')
const loans = list<Loan>('loans')
const balanceTotal = list<Account>('accounts').filter((a) => !a.archived).reduce((s, a) => s + toXPF(accountBalance(a, txs), a.currency, rates), 0)

describe('sélecteurs = ancien calcul de l’accueil (v1), sur la fixture au 13/11/2026', () => {
  it('à confirmer', () => {
    // Copie du calcul v1 (Dashboard.tsx, `due`)
    const v1 = [
      ...subs.flatMap((sub) => dueForPayment(sub, T).map((date) => ({ key: sub.id + date, name: sub.name, date }))),
      ...loans.flatMap((l) => dueInstallments(l, T).map((inst) => ({ key: l.id + inst.date, name: `${l.name} · mensualité ${inst.n}`, date: inst.date }))),
    ].sort((a, b) => a.date.localeCompare(b.date))
    expect(dueItems(subs, loans, T).map(({ key, name, date }) => ({ key, name, date }))).toEqual(v1)
    expect(v1.map((x) => x.name)).toEqual(['Voiture · mensualité 21', 'Streaming A']) // v1 : « Voiture · échéance 21 » (seul le mot change, lot 7)
  })

  it('à payer bientôt (30 jours)', () => {
    const from = addInterval(T, 1, 'day')
    const to = addInterval(T, 30, 'day')
    // Copie du calcul v1 (Dashboard.tsx, `upcoming`)
    const v1 = [
      ...upcomingPayments(subs, from, to).map(({ sub, date }) => {
        const acc = accounts.get(sub.accountId ?? '')
        const fee = effectiveFee(sub.currency, acc?.currency, acc?.fxFeePct)
        return { key: sub.id + date, name: sub.name, date, xpf: paymentXPF(sub, rates, fee), approx: !isExact(sub, fee) }
      }),
      ...loans.flatMap((l) => installmentsBetween(l, from, to).map((inst) => ({ key: l.id + inst.date, name: `${l.name} · mensualité`, date: inst.date, xpf: toXPF(inst.total, l.currency, rates), approx: !isFixedRate(l.currency) }))),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    expect(upcomingItems(subs, loans, accounts, rates, from, to).map(({ key, name, date, xpf, approx }) => ({ key, name, date, xpf, approx }))).toEqual(v1)
    expect(v1.slice(0, 4).map((x) => x.name)).toEqual(['Musique US', 'Essai gratuit', 'Stockage en ligne', 'Assurance annuelle'])
  })

  it('bloc « à confirmer et à payer d’ici 7 jours » : passés d’abord, puis demain → J+7, 5 lignes max', () => {
    const a = agenda(subs, loans, accounts, rates, T)
    expect(a.rows.map((r) => `${r.type}:${r.name}`)).toEqual(['due:Voiture · mensualité 21', 'due:Streaming A', 'upcoming:Musique US', 'upcoming:Essai gratuit'])
    expect(a.until).toBe('2026-11-20')
    expect(agenda(subs, loans, accounts, rates, T, 30, 5).rows).toHaveLength(5)
    expect(agenda([], [], accounts, rates, T).rows).toEqual([])
  })

  it('dernières opérations et totaux du mois', () => {
    const v1 = [...txs].filter((x) => x.type !== 'transfer').sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    expect(recentTransactions(txs, 5)).toEqual(v1)
    expect(recentTransactions(txs, 3)).toEqual(v1.slice(0, 3))
    const month = monthKey(T)
    const monthTxs = txs.filter((x) => monthKey(x.date) === month)
    const s = monthSummary(txs, month, accounts, rates)
    expect(s.totals).toEqual(totals(monthTxs, accounts, rates))
    expect(s.categories).toEqual(byCategory(monthTxs, accounts, rates))
    expect(Math.round(s.totals.expense)).toBe(128043) // valeur v1 à l'écran
    expect(s.totals.income).toBe(15000)
  })
})

describe('Q3 — « Il restera fin du mois », une seule fonction', () => {
  const rows = forecast({
    today: T, months: 3, startBalance: balanceTotal, rates, accounts, subscriptions: subs, loans, planned: list<Planned>('planned'), trips: list<Trip>('trips'),
    tripSpent: () => 0, variableMonthly: 99943,
  })
  it('donne exactement les valeurs de l’accueil v1', () => {
    const e = endOfMonth(balanceTotal, rows[0])
    expect(e).toEqual({ today: 875561, toPay: 83590, toReceive: 400000, remaining: 1191971 })
  })
  it('l’écart avec « Les mois à venir » = les dépenses du quotidien restantes du mois (notion différente)', () => {
    const e = endOfMonth(balanceTotal, rows[0])
    expect(e.remaining - rows[0].endBalance).toBe(rows[0].variable + rows[0].trips)
    expect(rows[0].endBalance).toBe(1135337) // « Au plus bas » / fin novembre v1
  })
  it('ligne « par jour »', () => {
    expect(perDay(1191971, T)).toEqual({ amount: 66200, days: 18, lastDay: '2026-11-30' })
    expect(perDay(0, T)).toBeUndefined()
    expect(perDay(-5000, T)).toBeUndefined()
    expect(perDay(50000, '2026-11-30')).toBeUndefined() // moins de 2 jours
    expect(perDay(50000, '2026-11-29')).toEqual({ amount: 25000, days: 2, lastDay: '2026-11-30' })
    expect(perDay(150, '2026-02-01')).toBeUndefined() // moins de 100 F par jour
  })
})
