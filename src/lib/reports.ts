import type { Account, Transaction } from '../data/types'
import { monthKey, type ISODate } from './dates'
import { toXPF, type Currency, type Rates } from './money'

/** Montant d'une opération en XPF, signé du point de vue du foyer (virements = 0). */
export function signedXPF(t: Transaction, accounts: Map<string, Account>, rates: Rates): number {
  if (t.type === 'transfer') return 0
  const cur: Currency = accounts.get(t.accountId)?.currency ?? 'XPF'
  const v = toXPF(t.amount, cur, rates)
  return t.type === 'expense' ? -v : v
}

export function accountBalance(a: Account, txs: Transaction[], upTo?: ISODate): number {
  let bal = a.initialBalance
  for (const t of txs) {
    if (t.deleted || (upTo && t.date > upTo)) continue
    // Le solde initial est « au » initialDate : les opérations antérieures y sont déjà comprises.
    if (a.initialDate && t.date < a.initialDate) continue
    if (t.accountId === a.id) {
      if (t.type === 'income') bal += t.amount
      else bal -= t.amount
    }
    if (t.type === 'transfer' && t.toAccountId === a.id) bal += t.toAmount ?? t.amount
  }
  return Math.round(bal * 100) / 100
}

export interface Totals {
  income: number
  expense: number
  net: number
}

export function totals(txs: Transaction[], accounts: Map<string, Account>, rates: Rates): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.deleted) continue
    const v = signedXPF(t, accounts, rates)
    if (v > 0) income += v
    else expense -= v
  }
  return { income, expense, net: income - expense }
}

export function byCategory(txs: Transaction[], accounts: Map<string, Account>, rates: Rates, type: 'expense' | 'income' = 'expense') {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.deleted || t.type !== type) continue
    const k = t.categoryId ?? ''
    map.set(k, (map.get(k) ?? 0) + Math.abs(signedXPF(t, accounts, rates)))
  }
  return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total)
}

export function byMonth(txs: Transaction[], accounts: Map<string, Account>, rates: Rates, months: string[]) {
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]))
  for (const t of txs) {
    if (t.deleted) continue
    const e = map.get(monthKey(t.date))
    if (!e) continue
    const v = signedXPF(t, accounts, rates)
    if (v > 0) e.income += v
    else e.expense -= v
  }
  return months.map((m) => map.get(m)!)
}
