import { useMemo } from 'react'
import { useList, useMap, useStore } from './store'
import { useBalances } from './hooks'
import { today } from '../lib/dates'
import { estimateVariable, forecast } from '../lib/forecast'
import { toXPF } from '../lib/money'

/** Prévisionnel sur `months` mois, partagé par l'accueil et la page Prévisionnel. */
export function useForecast(months: number) {
  const t = today()
  const rates = useStore((s) => s.settings.rates)
  const override = useStore((s) => s.settings.forecastVariable)
  const accounts = useMap('accounts')
  const txs = useList('transactions')
  const subs = useList('subscriptions')
  const loans = useList('loans')
  const planned = useList('planned')
  const trips = useList('trips')
  const balances = useBalances()

  const excluded = useMemo(
    () => new Set(['c-abonnements', 'c-credits', ...planned.filter((p) => p.active && p.kind === 'expense' && p.categoryId).map((p) => p.categoryId!)]),
    [planned],
  )
  const estimated = useMemo(() => estimateVariable(txs, t, accounts, rates, excluded), [txs, t, accounts, rates, excluded])
  const variable = override ?? estimated
  const rows = useMemo(() => forecast({
    today: t, months, startBalance: balances.total, rates, accounts, subscriptions: subs, loans, planned, trips,
    tripSpent: (trip) => txs.filter((x) => x.tripId === trip.id && x.type === 'expense' && !x.deleted)
      .reduce((s, x) => s + toXPF(x.amount, accounts.get(x.accountId)?.currency ?? 'XPF', rates), 0),
    variableMonthly: variable,
  }), [t, months, balances.total, rates, accounts, subs, loans, planned, trips, txs, variable])
  return { rows, estimated, variable, override, balances }
}
