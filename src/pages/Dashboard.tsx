import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CalendarClock, Check, TrendingDown, TrendingUp } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useAccounts, useBalances } from '../data/hooks'
import { addInterval, daysBetween, formatShortDate, monthKey, monthLabel, today } from '../lib/dates'
import { byCategory, totals } from '../lib/reports'
import { dueForPayment, isExact, paymentXPF, upcomingPayments } from '../lib/subscriptions'
import { dueInstallments, installmentsBetween, loanStatus } from '../lib/loans'
import { effectiveFee, isFixedRate, toXPF } from '../lib/money'
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
  const markLoanPaid = useStore((s) => s.markLoanPaid)
  const loans = useList('loans')
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
  // Prélèvements à venir : abonnements + échéances de prêt, sur 30 jours.
  type Item = { key: string; name: string; date: string; xpf: number; approx: boolean; color: string; to: string; remind: number; pay: () => void }
  const upcoming = useMemo<Item[]>(() => {
    const from = addInterval(t, 1, 'day')
    const to = addInterval(t, 30, 'day')
    const subItems = upcomingPayments(subs, from, to).map(({ sub, date }) => {
      const acc = accountsMap.get(sub.accountId ?? '')
      const fee = effectiveFee(sub.currency, acc?.currency, acc?.fxFeePct)
      return { key: sub.id + date, name: sub.name, date, xpf: paymentXPF(sub, rates, fee), approx: !isExact(sub, fee), color: sub.color, to: `/abonnements/${sub.id}`, remind: sub.remindDays, pay: () => {} }
    })
    const loanItems = loans.flatMap((l) => installmentsBetween(l, from, to).map((inst) => ({
      key: l.id + inst.date, name: `${l.name} · échéance`, date: inst.date, xpf: toXPF(inst.total, l.currency, rates), approx: !isFixedRate(l.currency),
      color: l.color, to: `/prets/${l.id}`, remind: 3, pay: () => {},
    })))
    return [...subItems, ...loanItems].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  }, [subs, loans, t, rates, accountsMap])
  const due = useMemo<Item[]>(() => {
    const subDue = subs.flatMap((sub) => dueForPayment(sub, t).map((date) => ({
      key: sub.id + date, name: sub.name, date, xpf: 0, approx: false, color: sub.color, to: `/abonnements/${sub.id}`, remind: 0,
      pay: () => {
        const before = useStore.getState().data.subscriptions[sub.id]
        const tx = markPaid(before, date)
        toast(`${sub.name} enregistré`, { label: 'Annuler', run: () => { remove('transactions', tx.id); useStore.getState().upsert('subscriptions', before) } })
      },
    })))
    const loanDue = loans.flatMap((l) => dueInstallments(l, t).map((inst) => ({
      key: l.id + inst.date, name: `${l.name} · échéance ${inst.n}`, date: inst.date, xpf: 0, approx: false, color: l.color, to: `/prets/${l.id}`, remind: 0,
      pay: () => {
        const before = useStore.getState().data.loans[l.id]
        const tx = markLoanPaid(before, inst)
        toast(`Échéance ${l.name} enregistrée`, { label: 'Annuler', run: () => { remove('transactions', tx.id); useStore.getState().upsert('loans', before) } })
      },
    })))
    return [...subDue, ...loanDue].sort((a, b) => a.date.localeCompare(b.date))
  }, [subs, loans, t, markPaid, markLoanPaid, remove, toast])
  const upcomingTotal = upcoming.reduce((s, u) => s + u.xpf, 0)
  const loanRows = loans.map((l) => ({ l, st: loanStatus(l, t) })).filter((r) => r.st.remaining > 0)
  const debt = loanRows.reduce((s, r) => s + toXPF(r.st.remaining, r.l.currency, rates), 0)

  const budgetRows = budgets
    .map((b) => ({ b, cat: cats.get(b.categoryId), spent: catTotals.find((c) => c.categoryId === b.categoryId)?.total ?? 0 }))
    .filter((r) => r.cat && !r.cat.deleted)
    .sort((a, b) => b.spent / b.b.amount - a.spent / a.b.amount)
    .slice(0, 3)

  return (
    <Page title={me ? `Ia ora na, ${me}` : 'Accueil'}>
      <div className="card stack" style={{ gap: 16 }}>
        <div className="hero">
          <span className="label">Solde de tous les comptes</span>
          <Money className="value" value={balances.total} approx={balances.approx} />
          {debt > 0 && <span className="faint">Prêts restant dus : <Money value={debt} /> · patrimoine net <Money value={balances.total - debt} /></span>}
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
              {due.slice(0, 6).map((d) => (
                <li key={d.key}>
                  <div className="row">
                    <AlertCircle size={20} className="warning" aria-hidden />
                    <Link className="main" to={d.to} style={{ color: 'inherit' }}>
                      <span className="title">{d.name}</span>
                      <span className="sub">Prélevé le {formatShortDate(d.date)} · pas encore dans les opérations</span>
                    </Link>
                    <button className="btn sm" onClick={d.pay}><Check size={16} />Payé</button>
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
              {upcoming.slice(0, 6).map((u) => {
                const d = daysBetween(t, u.date)
                return (
                  <li key={u.key}>
                    <Link className="row" to={u.to}>
                      <span className="dot" style={{ background: u.color, width: 12, height: 12 }} />
                      <div className="main">
                        <span className="title">{u.name}</span>
                        <span className="sub">{formatShortDate(u.date)} · {d === 1 ? 'demain' : `dans ${d} jours`}</span>
                      </div>
                      <div className="end">
                        <Money className="amount" value={u.xpf} approx={u.approx} />
                        {d <= u.remind && <span className="badge warn"><CalendarClock size={12} />Bientôt</span>}
                      </div>
                    </Link>
                  </li>
                )
              })}
              <li>
                <div className="row" style={{ minHeight: 48 }}>
                  <span className="main muted">Total sur 30 jours</span>
                  <Money className="amount" value={upcomingTotal} approx={upcoming.some((u) => u.approx)} />
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

      {loanRows.length > 0 && (
        <Section title="Prêts" action={<Link to="/prets">Détails</Link>}>
          <div className="card flush">
            <ul className="list">
              {loanRows.map(({ l, st }) => (
                <li key={l.id}>
                  <Link className="row" to={`/prets/${l.id}`}>
                    <span className="dot" style={{ background: l.color, width: 12, height: 12 }} />
                    <div className="main" style={{ gap: 6 }}>
                      <span className="title">{l.name}</span>
                      <Meter value={l.principal - st.remaining} max={l.principal} label={`Remboursé ${l.name}`} />
                    </div>
                    <div className="end"><Money className="amount" value={st.remaining} currency={l.currency} /><span className="faint">restant dû</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

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
