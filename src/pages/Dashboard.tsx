import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { pendingTicket } from '../lib/attachments'
import { Camera, Check, ChevronRight, Minus, Settings } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useBalances } from '../data/hooks'
import { useForecast } from '../data/useForecast'
import { useTripStatuses } from './Trips'
import { addInterval, daysBetween, formatLongDate, formatShortDate, monthKey, monthLabel, today } from '../lib/dates'
import { byCategory, totals } from '../lib/reports'
import { dueForPayment, isActive, isExact, monthlyCost, paymentXPF, upcomingPayments } from '../lib/subscriptions'
import { dueInstallments, installmentsBetween, loanStatus } from '../lib/loans'
import { effectiveFee, formatMoney, isFixedRate, toXPF } from '../lib/money'
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
  const fc = useForecast(3)
  const nextTrip = useTripStatuses().find((r) => r.st.phase !== 'après')

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
  const subsMonthly = subs.reduce((sum, sub) => {
    const acc = accountsMap.get(sub.accountId ?? '')
    return sum + monthlyCost(sub, rates, effectiveFee(sub.currency, acc?.currency, acc?.fxFeePct))
  }, 0)
  const activeSubs = subs.filter(isActive).length
  const loanMonthly = loanRows.reduce((sum, r) => sum + toXPF(r.st.payment + r.l.insuranceMonthly, r.l.currency, rates), 0)
  const debt = loanRows.reduce((s, r) => s + toXPF(r.st.remaining, r.l.currency, rates), 0)

  const budgetRows = budgets
    .map((b) => ({ b, cat: cats.get(b.categoryId), spent: catTotals.find((c) => c.categoryId === b.categoryId)?.total ?? 0 }))
    .filter((r) => r.cat && !r.cat.deleted)
    .sort((a, b) => b.spent / b.b.amount - a.spent / a.b.amount)
    .slice(0, 3)

  const nav = useNavigate()
  const complet = useStore((s) => s.settings.mode === 'complet')
  const first = fc.rows[0]
  const bills = first.subscriptions + first.loans + first.planned
  const expected = first.income
  const afterBills = balances.total - bills + expected
  const monthName = monthLabel(month).split(' ')[0]
  const recent = [...txs].filter((x) => x.type !== 'transfer').sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const topCats = catTotals.slice(0, 4)
  const maxCat = Math.max(1, ...topCats.map((c) => c.total))

  return (
    <main className="page">
      <section className="banner" aria-label="Où j'en suis">
        <svg className="banner-waves" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 70 45, 130 95, 200 70 S 330 45, 400 70 V120 H0Z" fill="#fff" opacity=".07" />
          <path d="M0 92 C 70 67, 130 117, 200 92 S 330 67, 400 92 V120 H0Z" fill="#fff" opacity=".08" />
        </svg>
        <div className="banner-top">
          <span className="brand"><img src="./icon.svg" alt="" width={32} height={32} />Fare Moni</span>
          <Link to="/parametres" className="banner-icon" aria-label="Réglages"><Settings size={20} /></Link>
        </div>
        <div>
          <h1 className="banner-hello">Ia ora na{me ? `, ${me}` : ''}</h1>
          <span className="banner-date">{formatLongDate(t)}</span>
        </div>
        <div className="banner-balance">
          <span>Sur nos comptes aujourd'hui</span>
          <Money className="banner-amount" value={balances.total} approx={balances.approx} />
        </div>
        {(bills > 0 || expected > 0) && (
          <div className="banner-lines">
            {bills > 0 && <div><span>Encore à payer en {monthName}</span><Money className="num" value={-bills} /></div>}
            {expected > 0 && <div><span>Encore à recevoir</span><Money className="num" value={expected} sign /></div>}
            <div className="strong"><span>Il restera fin {monthName}</span><Money className="num" value={afterBills} /></div>
          </div>
        )}
      </section>

      <div className="home-actions">
        <Link to="/rapide" className="btn primary big"><Minus size={22} />Ajouter une dépense</Link>
        <label className="btn big" style={{ cursor: 'pointer' }}>
          <Camera size={22} />Ticket
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { pendingTicket.file = f; nav('/rapide') } }} />
        </label>
      </div>

      {due.length > 0 && (
        <Section title="À confirmer">
          <div className="card flush">
            <ul className="list">
              {due.slice(0, 4).map((d) => (
                <li key={d.key}>
                  <div className="row">
                    <span className="dot" style={{ background: d.color, width: 12, height: 12 }} />
                    <Link className="main" to={d.to} style={{ color: 'inherit' }}>
                      <span className="title">{d.name}</span>
                      <span className="sub">Prévu le {formatShortDate(d.date).replace(/\.$/, '')}. C'est bien passé ?</span>
                    </Link>
                    <button className="btn sm" onClick={d.pay}><Check size={16} />Oui</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section title={`Ce mois-ci · ${monthName}`} action={<Link to="/rapports">Détail</Link>}>
        <div className="card stack" style={{ gap: 14 }}>
          <div className="split">
            <div><div className="faint">Dépensé</div><Money className="big-num" value={tot.expense} /></div>
            <div style={{ textAlign: 'right' }}><div className="faint">Reçu</div><Money className="big-num income" value={tot.income} /></div>
          </div>
          {topCats.length === 0 ? <p className="muted" style={{ margin: 0 }}>Rien pour l'instant. Touchez « Ajouter une dépense ».</p> : topCats.map((c) => {
            const cat = cats.get(c.categoryId)
            return (
              <Link key={c.categoryId} to={`/operations?cat=${c.categoryId || 'none'}&mois=${month}`} className="simple-bar">
                <CatIcon icon={cat?.icon} color={cat?.color} small />
                <div className="grow">
                  <div className="split"><span>{cat?.name ?? 'À classer'}</span><Money className="num" value={c.total} /></div>
                  <div className="track"><span style={{ width: `${(c.total / maxCat) * 100}%`, background: cat?.color ?? '#94A3B8' }} /></div>
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      <Section title="À payer bientôt" action={<Link to="/abonnements?vue=avenir">Tout voir</Link>}>
        <div className="card flush">
          {upcoming.length === 0 ? <p className="row muted">Rien de prévu dans les 30 jours.</p> : (
            <ul className="list">
              {upcoming.slice(0, 4).map((u) => {
                const d = daysBetween(t, u.date)
                return (
                  <li key={u.key}>
                    <Link className="row" to={u.to}>
                      <span className="dot" style={{ background: u.color, width: 12, height: 12 }} />
                      <div className="main">
                        <span className="title">{u.name.replace(' · échéance', '')}</span>
                        <span className="sub">{d === 1 ? 'Demain' : `Dans ${d} jours`} · {formatShortDate(u.date)}</span>
                      </div>
                      <Money className="amount" value={u.xpf} approx={u.approx} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Dernières dépenses et rentrées" action={<Link to="/operations">Historique</Link>}>
        <div className="card flush">
          {recent.length === 0 ? <p className="row muted">Aucune pour l'instant.</p> : (
            <ul className="list">
              {recent.map((x) => {
                const cat = cats.get(x.categoryId ?? '')
                const acc = accountsMap.get(x.accountId)
                return (
                  <li key={x.id}>
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
        <Link to={`/voyages/${nextTrip.trip.id}`} className="card split" style={{ color: 'inherit' }}>
          <div><strong>✈ {nextTrip.trip.name}</strong><div className="faint">{nextTrip.st.phase === 'pendant' ? 'En cours' : `Départ dans ${nextTrip.st.daysToGo} jours`}{nextTrip.st.toSave > 0 ? ` · mettre ${formatMoney(nextTrip.st.perMonth)} de côté par mois` : ''}</div></div>
          <ChevronRight size={18} className="faint" />
        </Link>
      )}

      {complet && (
        <>
          <Section title="En bref">
            <div className="tiles">
              <Link to="/previsionnel" className="tile"><span className="tile-label">Fin {monthLabel(fc.rows[1].month).split(' ')[0]} (prévu)</span><Money className={`tile-value ${fc.rows[1].endBalance < 0 ? 'expense' : ''}`} value={fc.rows[1].endBalance} approx /></Link>
              <Link to="/abonnements" className="tile"><span className="tile-label">Abonnements</span><Money className="tile-value" value={subsMonthly} approx /><span className="tile-sub">par mois · {activeSubs} actifs</span></Link>
              {loanRows.length > 0 && <Link to="/prets" className="tile"><span className="tile-label">Crédits</span><Money className="tile-value" value={debt} /><span className="tile-sub">reste à rembourser · {formatMoney(loanMonthly)}/mois</span></Link>}
              <Link to="/comptes" className="tile"><span className="tile-label">Comptes</span><strong className="tile-value">{balances.rows.length}</strong><span className="tile-sub">voir les soldes</span></Link>
            </div>
          </Section>
          {budgetRows.length > 0 && (
            <Section title="Budgets du mois" action={<Link to="/budgets">Gérer</Link>}>
              <div className="card stack" style={{ gap: 16 }}>
                {budgetRows.map(({ b, cat, spent }) => (
                  <div key={b.id} className="stack" style={{ gap: 6 }}>
                    <div className="split"><span>{cat!.name}</span><span className="faint num">{spent > b.amount ? <strong className="expense">Dépassé · </strong> : null}<Money value={spent} /> / <Money value={b.amount} /></span></div>
                    <Meter value={spent} max={b.amount} label={`Budget ${cat!.name}`} />
                  </div>
                ))}
              </div>
            </Section>
          )}
          <p className="faint" style={{ margin: 0, textAlign: 'center' }}>Total prévu sur 30 jours : {formatMoney(upcomingTotal)}</p>
        </>
      )}
    </main>
  )
}
