import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CalendarClock, Check, TrendingDown, TrendingUp } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useAccounts, useBalances } from '../data/hooks'
import { addInterval, daysBetween, formatShortDate, monthKey, monthLabel, today } from '../lib/dates'
import { byCategory, totals } from '../lib/reports'
import { dueForPayment, isExact, paymentXPF, upcomingPayments } from '../lib/subscriptions'
import { Money } from '../ui/Money'
import { Page, Section } from '../ui/Page'
import { Meter, RankedBars } from '../ui/Charts'
import { CatIcon } from '../ui/Icon'
import { useToast } from '../ui/toast'

export default function Dashboard() {
  const nav = useNavigate()
  const rates = useStore((s) => s.settings.rates)
  const me = useStore((s) => s.data.members[s.settings.currentMember ?? '']?.name)
  const markPaid = useStore((s) => s.markSubscriptionPaid)
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)
  const txs = useList('transactions')
  const subs = useList('subscriptions')
  const budgets = useList('budgets')
  const cats = useMap('categories')
  const accountsMap = useMap('accounts')
  const accounts = useAccounts()
  const balances = useBalances()
  const t = today()
  const month = monthKey(t)

  const monthTxs = useMemo(() => txs.filter((x) => monthKey(x.date) === month), [txs, month])
  const tot = useMemo(() => totals(monthTxs, accountsMap, rates), [monthTxs, accountsMap, rates])
  const catTotals = useMemo(() => byCategory(monthTxs, accountsMap, rates), [monthTxs, accountsMap, rates])
  const upcoming = useMemo(() => upcomingPayments(subs, addInterval(t, 1, 'day'), addInterval(t, 30, 'day')), [subs, t])
  const due = useMemo(() => subs.flatMap((s) => dueForPayment(s, t).map((date) => ({ sub: s, date }))).sort((a, b) => a.date.localeCompare(b.date)), [subs, t])
  const upcomingTotal = upcoming.reduce((s, u) => s + paymentXPF(u.sub, rates, accountsMap.get(u.sub.accountId ?? '')?.fxFeePct), 0)

  const budgetRows = budgets
    .map((b) => ({ b, cat: cats.get(b.categoryId), spent: catTotals.find((c) => c.categoryId === b.categoryId)?.total ?? 0 }))
    .filter((r) => r.cat && !r.cat.deleted)
    .sort((a, b) => b.spent / b.b.amount - a.spent / a.b.amount)
    .slice(0, 3)

  const pay = (sub: (typeof due)[number]['sub'], date: string) => {
    const before = sub
    const tx = markPaid(sub, date)
    toast(`${sub.name} enregistré`, {
      label: 'Annuler',
      run: () => {
        remove('transactions', tx.id)
        useStore.getState().upsert('subscriptions', before)
      },
    })
  }

  return (
    <Page title={me ? `Ia ora na, ${me}` : 'Accueil'}>
      <div className="card stack" style={{ gap: 16 }}>
        <div className="hero">
          <span className="label">Solde de tous les comptes</span>
          <Money className="value" value={balances.total} approx={balances.approx} />
        </div>
        <div className="kpis">
          <div className="kpi">
            <span className="label"><TrendingUp size={16} className="income" />Revenus · {monthLabel(month).split(' ')[0]}</span>
            <Money className="value" value={tot.income} />
          </div>
          <div className="kpi">
            <span className="label"><TrendingDown size={16} className="expense" />Dépenses · {monthLabel(month).split(' ')[0]}</span>
            <Money className="value" value={tot.expense} />
          </div>
        </div>
      </div>

      {due.length > 0 && (
        <Section title="À enregistrer">
          <div className="card flush">
            <ul className="list">
              {due.slice(0, 6).map(({ sub, date }) => (
                <li key={sub.id + date}>
                  <div className="row">
                    <AlertCircle size={20} className="warning" aria-hidden />
                    <div className="main">
                      <span className="title">{sub.name}</span>
                      <span className="sub">Prélevé le {formatShortDate(date)} · pas encore dans les opérations</span>
                    </div>
                    <button className="btn sm" onClick={() => pay(sub, date)}><Check size={16} />Payé</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section title="Prochains prélèvements · 30 jours" action={<Link to="/abonnements?vue=avenir">Tout voir</Link>}>
        <div className="card flush">
          {upcoming.length === 0 ? (
            <p className="row muted">Aucun prélèvement prévu.</p>
          ) : (
            <ul className="list">
              {upcoming.slice(0, 5).map(({ sub, date }) => {
                const d = daysBetween(t, date)
                const soon = d <= sub.remindDays
                const fee = accountsMap.get(sub.accountId ?? '')?.fxFeePct
                return (
                  <li key={sub.id + date}>
                    <Link className="row" to={`/abonnements/${sub.id}`}>
                      <span className="dot" style={{ background: sub.color, width: 12, height: 12 }} />
                      <div className="main">
                        <span className="title">{sub.name}</span>
                        <span className="sub">{formatShortDate(date)} · {d === 1 ? 'demain' : `dans ${d} jours`}</span>
                      </div>
                      <div className="end">
                        <Money className="amount" value={paymentXPF(sub, rates, fee)} approx={!isExact(sub, fee)} />
                        {soon && <span className="badge warn"><CalendarClock size={12} />Bientôt</span>}
                      </div>
                    </Link>
                  </li>
                )
              })}
              <li>
                <div className="row" style={{ minHeight: 48 }}>
                  <span className="main muted">Total sur 30 jours</span>
                  <Money className="amount" value={upcomingTotal} approx={upcoming.some((u) => !isExact(u.sub))} />
                </div>
              </li>
            </ul>
          )}
        </div>
      </Section>

      {budgetRows.length > 0 && (
        <Section title="Budgets du mois" action={<Link to="/budgets">Gérer</Link>}>
          <div className="card stack" style={{ gap: 16 }}>
            {budgetRows.map(({ b, cat, spent }) => (
              <div key={b.id} className="stack" style={{ gap: 6 }}>
                <div className="split">
                  <span>{cat!.name}</span>
                  <span className="faint num">
                    {spent > b.amount ? <strong className="expense">Dépassé · </strong> : null}
                    <Money value={spent} /> / <Money value={b.amount} />
                  </span>
                </div>
                <Meter value={spent} max={b.amount} label={`Budget ${cat!.name}`} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Dépenses du mois" action={<Link to="/rapports">Rapports</Link>}>
        <div className="card">
          {catTotals.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Aucune dépense ce mois-ci. Ajoutez-en avec le bouton + ou importez un relevé.</p>
          ) : (
            <RankedBars
              total={tot.expense}
              onSelect={(id) => nav(`/operations?cat=${id || 'none'}&mois=${month}`)}
              items={catTotals.slice(0, 6).map((c) => {
                const cat = cats.get(c.categoryId)
                return { key: c.categoryId, label: cat?.name ?? 'Sans catégorie', value: c.total, icon: cat?.icon, color: cat?.color }
              })}
            />
          )}
        </div>
      </Section>

      <Section title="Comptes" action={<Link to="/comptes">Gérer</Link>}>
        <div className="card flush">
          <ul className="list">
            {balances.rows.map(({ account: a, balance, xpf }) => (
              <li key={a.id}>
                <Link className="row" to={`/operations?compte=${a.id}`}>
                  <CatIcon icon={a.type === 'cash' ? 'banknote' : a.type === 'credit' ? 'credit-card' : a.type === 'savings' ? 'piggy-bank' : 'landmark'} color={a.color} />
                  <div className="main">
                    <span className="title">{a.name}</span>
                    {a.currency !== 'XPF' && <span className="sub"><Money value={xpf} approx={a.currency !== 'EUR'} /></span>}
                  </div>
                  <Money className="amount" value={balance} currency={a.currency} tone />
                </Link>
              </li>
            ))}
            {accounts.length === 0 && <li className="row muted">Aucun compte.</li>}
          </ul>
        </div>
      </Section>
    </Page>
  )
}
