import { useMemo } from 'react'
import { useList, useMap, useStore } from './store'
import type { Account, Category, Transaction } from './types'
import { accountBalance } from '../lib/reports'
import { isFixedRate, toXPF } from '../lib/money'

/** Comptes courants d'abord : le premier sert de compte par défaut. */
const TYPE_ORDER = { checking: 0, credit: 1, savings: 2, cash: 3 } as const

export function useAccounts(includeArchived = false): Account[] {
  const list = useList('accounts')
  return useMemo(
    () =>
      list
        .filter((a) => includeArchived || !a.archived)
        .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name, 'fr')),
    [list, includeArchived],
  )
}

export function useCategories(): Category[] {
  const list = useList('categories')
  return useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [list])
}

export function useTransactions(): Transaction[] {
  const list = useList('transactions')
  return useMemo(() => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)), [list])
}

export function useMembers() {
  const list = useList('members')
  return useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [list])
}

export const COMMON = 'commun'

export function useMemberName() {
  const members = useMap('members')
  return (id?: string) => (id && id !== COMMON ? members.get(id)?.name : id === COMMON ? 'Commun' : undefined)
}

/** Soldes des comptes (devise du compte) + total XPF. `approx` si un compte est en devise à taux variable. */
export function useBalances() {
  const accounts = useAccounts()
  const txs = useList('transactions')
  const rates = useStore((s) => s.settings.rates)
  return useMemo(() => {
    const rows = accounts.map((a) => {
      const balance = accountBalance(a, txs)
      return { account: a, balance, xpf: toXPF(balance, a.currency, rates) }
    })
    return {
      rows,
      total: rows.reduce((s, r) => s + r.xpf, 0),
      approx: rows.some((r) => !isFixedRate(r.account.currency) && r.balance !== 0),
    }
  }, [accounts, txs, rates])
}

export function useAllTags(): string[] {
  const txs = useList('transactions')
  const subs = useList('subscriptions')
  return useMemo(() => {
    const count = new Map<string, number>()
    for (const x of [...txs, ...subs]) for (const t of x.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [txs, subs])
}
