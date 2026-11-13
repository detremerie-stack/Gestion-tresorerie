import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Settings } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useBalances } from '../data/hooks'
import { useForecast } from '../data/useForecast'
import { agenda, monthSummary, recentTransactions, upcomingItems } from '../data/selectors'
import { useTripStatuses } from './Trips'
import { addInterval, daysBetween, formatLongDate, formatShortDate, monthKey, monthLabel, split, today } from '../lib/dates'
import { endOfMonth, perDay } from '../lib/forecast'
import { isActive, monthlyCost } from '../lib/subscriptions'
import { loanStatus } from '../lib/loans'
import { effectiveFee, formatMoney, toXPF } from '../lib/money'
import { Money } from '../ui/Money'
import { Section } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { CatIcon } from '../ui/Icon'
import { useToast } from '../ui/toast'

export default function Dashboard() {
  const rates = useStore((s) => s.settings.rates)
  const me = useStore((s) => s.data.members[s.settings.currentMember ?? '']?.name)
  const markPaid = useStore((s) => s.markSubscriptionPaid)
  const markLoanPaid = useStore((s) => s.markLoanPaid)
  const complet = useStore((s) => s.settings.mode === 'complet')
  const loans = useList('loans')
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)
  const txs = useList('transactions')
  const subs = useList('subscriptions')
  const budgets = useList('budgets')
  const cats = useMap('categories')
  const accountsMap = useMap('accounts')
  const balances = useBalances()
  const t = today()
  const month = monthKey(t)
  const monthName = monthLabel(month).split(' ')[0]
  const fc = useForecast(3)
  const nextTrip = useTripStatuses().find((r) => r.st.phase !== 'après')

  // 1. Il restera fin du mois (fonction unique, Q3)
  const eom = endOfMonth(balances.total, fc.rows[0])
  const daily = perDay(eom.remaining, t)

  // 2. À confirmer et à payer d'ici 7 jours
  const ag = useMemo(() => agenda(subs, loans, accountsMap, rates, t, 7, 5), [subs, loans, accountsMap, rates, t])
  const confirm = (kind: 'subscription' | 'loan', id: string, date: string) => {
    if (kind === 'subscription') {
      const before = useStore.getState().data.subscriptions[id]
      const tx = markPaid(before, date)
      toast(`${before.name} enregistré`, { label: 'Annuler', run: () => { remove('transactions', tx.id); useStore.getState().upsert('subscriptions', before) } })
    } else {
      const before = useStore.getState().data.loans[id]
      const item = ag.rows.find((r) => r.type === 'due' && r.id === id && r.date === date)
      if (!item || item.type !== 'due' || !item.installment) return
      const tx = markLoanPaid(before, item.installment)
      toast(`Échéance ${before.name} enregistrée`, { label: 'Annuler', run: () => { remove('transactions', tx.id); useStore.getState().upsert('loans', before) } })
    }
  }

  // 3. Ce mois-ci
  const summary = useMemo(() => monthSummary(txs, month, accountsMap, rates), [txs, month, accountsMap, rates])
  const topCats = summary.categories.slice(0, 4)
  const maxCat = Math.max(1, ...topCats.map((c) => c.total))

  // 4. Dernières opérations (3 sur téléphone, 5 sur PC)
  const recent = useMemo(() => recentTransactions(txs, 5), [txs])

  // Mode complet : limites du mois et « En bref »
  const upcoming30 = useMemo(() => upcomingItems(subs, loans, accountsMap, rates, addInterval(t, 1, 'day'), addInterval(t, 30, 'day')), [subs, loans, accountsMap, rates, t])
  const upcomingTotal = upcoming30.reduce((s, u) => s + u.xpf, 0)
  const loanRows = loans.map((l) => ({ l, st: loanStatus(l, t) })).filter((r) => r.st.remaining > 0)
  const subsMonthly = subs.reduce((sum, sub) => {
    const acc = accountsMap.get(sub.accountId ?? '')
    return sum + monthlyCost(sub, rates, effectiveFee(sub.currency, acc?.currency, acc?.fxFeePct))
  }, 0)
  const activeSubs = subs.filter(isActive).length
  const loanMonthly = loanRows.reduce((sum, r) => sum + toXPF(r.st.payment + r.l.insuranceMonthly, r.l.currency, rates), 0)
  const debt = loanRows.reduce((s, r) => s + toXPF(r.st.remaining, r.l.currency, rates), 0)
  const budgetRows = budgets
    .map((b) => ({ b, cat: cats.get(b.categoryId), spent: summary.categories.find((c) => c.categoryId === b.categoryId)?.total ?? 0 }))
    .filter((r) => r.cat && !r.cat.deleted)
    .sort((a, b) => b.spent / b.b.amount - a.spent / a.b.amount)
    .slice(0, 3)

  const lastDay = split(daily?.lastDay ?? t)[2]
  const detail = [
    eom.toPay > 0 && <span key="p"><span className="num">{formatMoney(-eom.toPay)}</span> encore à payer</span>,
    eom.toReceive > 0 && <span key="r"><span className="num">{formatMoney(eom.toReceive, 'XPF', { sign: true })}</span> à recevoir</span>,
  ].filter(Boolean)

  return (
    <main className="page wide home">
      <section className="banner home-hero" aria-label="Où on en est">
        <svg className="banner-waves" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 70 45, 130 95, 200 70 S 330 45, 400 70 V120 H0Z" fill="#fff" opacity=".07" />
          <path d="M0 92 C 70 67, 130 117, 200 92 S 330 67, 400 92 V120 H0Z" fill="#fff" opacity=".08" />
        </svg>
        <div className="banner-top phone-only">
          <span className="brand"><img src="./icon.svg" alt="" width={32} height={32} />Fare Moni</span>
          <Link to="/parametres" className="banner-icon" aria-label="Réglages"><Settings size={20} /></Link>
        </div>
        <div>
          <h1 className="banner-hello">Ia ora na{me ? `, ${me}` : ''}</h1>
          <span className="banner-date">{formatLongDate(t)}</span>
        </div>
        <div className="banner-main">
          <span className="banner-label">Il restera fin {monthName}</span>
          <Money className="banner-amount" value={eom.remaining} approx={balances.approx} />
          {eom.remaining < 0 && <span className="banner-alert">Attention : le compte passerait à découvert</span>}
          {daily && <span className="banner-perday">soit environ {formatMoney(daily.amount)} par jour jusqu'au {lastDay}</span>}
        </div>
        <div className="banner-today">
          <span>Aujourd'hui sur nos comptes</span>
          <Money className="num" value={eom.today} approx={balances.approx} />
        </div>
        {detail.length > 0 && <span className="banner-detail">{detail.flatMap((d, i) => (i ? [<span key={`s${i}`}> · </span>, d] : [d]))}</span>}
      </section>

      <Section title="À confirmer et à payer d'ici 7 jours" action={<Link to="/abonnements?vue=avenir">Tout voir</Link>} className="home-conf">
        <div className="card flush">
          {ag.rows.length === 0 ? <p className="row muted">Rien à confirmer ni à payer d'ici le {formatShortDate(ag.until)}</p> : (
            <ul className="list">
              {ag.rows.map((r) => {
                if (r.type === 'due') {
                  const ago = daysBetween(r.date, t)
                  return (
                    <li key={r.key}>
                      <div className="row">
                        <span className="dot" style={{ background: r.color, width: 12, height: 12 }} />
                        <Link className="main" to={r.to} style={{ color: 'inherit' }}>
                          <span className="title">{r.name}</span>
                          <span className="sub"><span className="badge warn">{ago === 1 ? 'Prévu hier' : ago === 0 ? "Prévu aujourd'hui" : `Prévu le ${formatShortDate(r.date)}`}</span> C'est passé ?</span>
                        </Link>
                        <button className="btn sm" aria-label={`Oui, ${r.name} est passé`} onClick={() => confirm(r.kind, r.id, r.date)}><Check size={16} />Oui</button>
                      </div>
                    </li>
                  )
                }
                const d = daysBetween(t, r.date)
                return (
                  <li key={r.key}>
                    <Link className="row" to={r.to}>
                      <span className="dot" style={{ background: r.color, width: 12, height: 12 }} />
                      <div className="main">
                        <span className="title">{r.name.replace(' · échéance', '')}</span>
                        <span className="sub">{d === 1 ? 'Demain' : `Dans ${d} jours`} · {formatShortDate(r.date)}</span>
                      </div>
                      <Money className="amount" value={r.xpf} approx={r.approx} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section title={`Ce mois-ci · ${monthName}`} action={<Link to="/rapports">Tout voir</Link>} className="home-mois">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="split">
            <div><div className="faint">Dépensé</div><Money className="big-num" value={summary.totals.expense} /></div>
            <div style={{ textAlign: 'right' }}><div className="faint">Reçu</div><Money className="big-num income" value={summary.totals.income} /></div>
          </div>
          {topCats.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Rien de noté ce mois-ci. <span className="phone-only">Touchez + pour ajouter une dépense.</span><span className="desk-only">Cliquez sur « Nouvelle dépense » ou tapez N.</span></p>
          ) : topCats.map((c) => {
            const cat = cats.get(c.categoryId)
            return (
              <Link key={c.categoryId} to={`/operations?cat=${c.categoryId || 'none'}&mois=${month}`} className="simple-bar">
                <CatIcon icon={cat?.icon} color={cat?.color} small />
                <div className="grow">
                  <div className="split"><span>{cat?.name ?? 'À classer'}</span><Money className="num" value={c.total} /></div>
                  <div className="track"><span className="cat-bar" style={{ width: `${(c.total / maxCat) * 100}%`, '--c': cat?.color ?? '#94A3B8' } as CSSProperties} /></div>
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      <Section title="Dernières opérations" action={<Link to="/operations">Historique</Link>} className="home-rec">
        <div className="card flush">
          {recent.length === 0 ? <p className="row muted">Aucune dépense notée pour l'instant.</p> : (
            <ul className="list">
              {recent.map((x, i) => {
                const cat = cats.get(x.categoryId ?? '')
                const acc = accountsMap.get(x.accountId)
                return (
                  <li key={x.id} className={i >= 3 ? 'desk-only' : undefined}>
                    <Link className="row" to={`/operations/${x.id}`}>
                      <CatIcon icon={cat?.icon} color={cat?.color} small />
                      <div className="main">
                        <span className="title">{x.payee || cat?.name || 'Dépense'}</span>
                        <span className="sub">{formatShortDate(x.date)} · {cat?.name ?? 'À classer'}</span>
                      </div>
                      <Money className={`amount ${x.type}`} value={x.type === 'expense' ? -x.amount : x.amount} currency={acc?.currency} sign={x.type === 'income'} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Section>

      {nextTrip && (
        <Link to={`/voyages/${nextTrip.trip.id}`} className="card split home-full" style={{ color: 'inherit' }}>
          <div><strong>✈ {nextTrip.trip.name}</strong><div className="faint">{nextTrip.st.phase === 'pendant' ? 'En cours' : `Départ dans ${nextTrip.st.daysToGo} jours`}{nextTrip.st.toSave > 0 ? ` · mettre ${formatMoney(nextTrip.st.perMonth)} de côté par mois` : ''}</div></div>
          <ChevronRight size={18} className="faint" />
        </Link>
      )}

      {complet && budgetRows.length > 0 && (
        <Section title="Limites du mois" action={<Link to="/budgets">Gérer</Link>} className="home-lim">
          <div className="card stack" style={{ gap: 16 }}>
            {budgetRows.map(({ b, cat, spent }) => (
              <div key={b.id} className="stack" style={{ gap: 6 }}>
                <div className="split"><span>{cat!.name}</span><span className="faint num">{spent > b.amount ? <strong className="danger-text">Dépassé · </strong> : null}<Money value={spent} /> / <Money value={b.amount} /></span></div>
                <Meter value={spent} max={b.amount} label={`Limite ${cat!.name}`} />
              </div>
            ))}
          </div>
        </Section>
      )}
      {complet && (
        <Section title="En bref" className="home-bref">
          <div className="tiles">
            <Link to="/previsionnel" className="tile"><span className="tile-label">Fin {monthLabel(fc.rows[1].month).split(' ')[0]}, prévu</span><Money className={`tile-value ${fc.rows[1].endBalance < 0 ? 'danger-text' : ''}`} value={fc.rows[1].endBalance} approx /></Link>
            <Link to="/abonnements" className="tile"><span className="tile-label">Abonnements</span><Money className="tile-value" value={subsMonthly} approx /><span className="tile-sub">par mois · {activeSubs} actifs</span></Link>
            {loanRows.length > 0 && <Link to="/prets" className="tile"><span className="tile-label">Crédits</span><Money className="tile-value" value={debt} /><span className="tile-sub">reste à rembourser · {formatMoney(loanMonthly)}/mois</span></Link>}
            <Link to="/comptes" className="tile"><span className="tile-label">Comptes</span><strong className="tile-value">{balances.rows.length}</strong><span className="tile-sub">voir les soldes</span></Link>
          </div>
          <p className="faint" style={{ margin: 0, textAlign: 'center' }}>Total prévu sur 30 jours : {formatMoney(upcomingTotal)}</p>
        </Section>
      )}
    </main>
  )
}
