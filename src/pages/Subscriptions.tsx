import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, Check, Plus, Repeat } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import type { Subscription } from '../data/types'
import { addInterval, daysBetween, formatDate, monthKey, monthLabel, today } from '../lib/dates'
import { costByTag, cycleLabel, dueForPayment, isActive, isExact, monthlyCost, nextPayment, paymentXPF, upcomingPayments, yearlyCost } from '../lib/subscriptions'
import { formatMoney } from '../lib/money'
import { Money } from '../ui/Money'
import { Empty, Page, Section } from '../ui/Page'
import { Segmented } from '../ui/Field'
import { useToast } from '../ui/toast'

type Tab = 'liste' | 'avenir' | 'rapport'
type Sort = 'date' | 'nom' | 'prix'

function dueLabel(days: number) {
  if (days === 0) return { n: "Auj.", u: '' }
  if (days < 31) return { n: String(days), u: 'j' }
  return { n: String(Math.round(days / 30.44)), u: 'mois' }
}

export default function Subscriptions() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('vue') as Tab) || 'liste'
  const setTab = (t: Tab) => setParams(t === 'liste' ? {} : { vue: t }, { replace: true })
  const subs = useList('subscriptions')
  const accounts = useMap('accounts')
  const rates = useStore((s) => s.settings.rates)
  const view = useStore((s) => s.settings.subscriptionsView)
  const setSettings = useStore((s) => s.setSettings)
  const t = today()
  const fee = (s: Subscription) => accounts.get(s.accountId ?? '')?.fxFeePct ?? 0

  const monthly = subs.reduce((sum, s) => sum + monthlyCost(s, rates, fee(s)), 0)
  const yearly = subs.reduce((sum, s) => sum + yearlyCost(s, rates, fee(s)), 0)
  const approx = subs.some((s) => isActive(s) && !isExact(s, fee(s)))

  return (
    <Page
      title="Abonnements"
      aside={
        <button className="btn sm" style={{ border: 0, flexDirection: 'column', gap: 0, alignItems: 'flex-end', minHeight: 44 }}
          onClick={() => setSettings({ subscriptionsView: view === 'month' ? 'year' : 'month' })} aria-label="Basculer mensuel / annuel">
          <span className="faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{view === 'month' ? 'Par mois' : 'Par an'} <ArrowDownUp size={12} /></span>
          <Money value={view === 'month' ? monthly : yearly} approx={approx} className="num" />
        </button>
      }
    >
      <Segmented label="Vue" value={tab} onChange={setTab} options={[{ value: 'liste', label: 'Liste' }, { value: 'avenir', label: 'À venir' }, { value: 'rapport', label: 'Rapport' }]} />
      {subs.length === 0 ? (
        <Empty icon={<Repeat size={40} />} title="Aucun abonnement">
          <Link className="btn primary" to="/abonnements/nouveau"><Plus size={18} />Ajouter un abonnement</Link>
        </Empty>
      ) : tab === 'liste' ? (
        <SubList subs={subs} today={t} fee={fee} />
      ) : tab === 'avenir' ? (
        <Upcoming subs={subs} today={t} fee={fee} />
      ) : (
        <Report subs={subs} fee={fee} monthly={monthly} yearly={yearly} />
      )}
    </Page>
  )
}

function SubList({ subs, today: t, fee }: { subs: Subscription[]; today: string; fee: (s: Subscription) => number }) {
  const rates = useStore((s) => s.settings.rates)
  const [sort, setSort] = useState<Sort>('date')
  const [showInactive, setShowInactive] = useState(false)
  const rows = useMemo(() => {
    const list = subs.map((s) => ({ s, next: nextPayment(s, t), due: dueForPayment(s, t).length }))
    const active = list.filter((r) => isActive(r.s))
    const sorted = active.sort((a, b) =>
      sort === 'nom' ? a.s.name.localeCompare(b.s.name, 'fr')
        : sort === 'prix' ? monthlyCost(b.s, rates, fee(b.s)) - monthlyCost(a.s, rates, fee(a.s))
          : (a.next ?? '9').localeCompare(b.next ?? '9'))
    return { active: sorted, inactive: list.filter((r) => !isActive(r.s)) }
  }, [subs, t, sort, rates, fee])

  return (
    <>
      <div className="split">
        <div className="chips" role="group" aria-label="Trier par">
          {([['date', 'Échéance'], ['prix', 'Prix'], ['nom', 'Nom']] as const).map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={sort === v} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
        <Link to="/abonnements/nouveau" className="btn sm primary"><Plus size={16} />Ajouter</Link>
      </div>
      <div className="subs">
        {rows.active.map(({ s, next, due }) => <SubCard key={s.id} s={s} next={next} today={t} fee={fee(s)} due={due} />)}
      </div>
      {rows.inactive.length > 0 && (
        <Section title={`En pause ou résiliés (${rows.inactive.length})`} action={<button onClick={() => setShowInactive(!showInactive)}>{showInactive ? 'Masquer' : 'Afficher'}</button>}>
          {showInactive && <div className="subs">{rows.inactive.map(({ s }) => <SubCard key={s.id} s={s} next={null} today={t} fee={fee(s)} due={0} />)}</div>}
        </Section>
      )}
    </>
  )
}

function SubCard({ s, next, today: t, fee, due }: { s: Subscription; next: string | null; today: string; fee: number; due: number }) {
  const rates = useStore((st) => st.settings.rates)
  const view = useStore((st) => st.settings.subscriptionsView)
  const exact = isExact(s, fee)
  const perPayment = paymentXPF(s, rates, fee)
  const isMonthly = s.unit === 'month' && s.every === 1
  const main = view === 'year' ? yearlyCost(s, rates, fee) : isMonthly ? perPayment : monthlyCost(s, rates, fee)
  const days = next ? daysBetween(t, next) : null
  const d = days != null ? dueLabel(days) : null
  return (
    <Link to={`/abonnements/${s.id}`} className={`sub-card${isActive(s) ? '' : ' inactive'}`} style={{ ['--c' as string]: s.color }}>
      <div className="main">
        <div className="name">{s.name}</div>
        <div className="plan">
          {s.status === 'trial' && <span className="badge primary">Essai</span>} {s.status === 'paused' && <span className="badge">En pause</span>}
          {s.status === 'cancelled' && <span className="badge">Résilié</span>} {due > 0 && <span className="badge warn">À enregistrer</span>} {s.plan ?? cycleLabel(s)}
        </div>
      </div>
      <div className="price">
        <div className="big"><Money value={main} approx={!exact} /></div>
        <div className="small">
          {s.currency !== 'XPF' ? formatMoney(s.amount, s.currency) : ''}
          {!isMonthly || view === 'year' ? `${s.currency !== 'XPF' ? ' · ' : ''}${view === 'year' ? 'par an' : `${formatMoney(perPayment)} ${cycleLabel(s).toLowerCase()}`}` : ''}
        </div>
      </div>
      {d && (
        <div className="due" aria-label={`Prochain prélèvement le ${formatDate(next!)}`}>
          <strong>{d.n}</strong>{d.u}
        </div>
      )}
    </Link>
  )
}

function Upcoming({ subs, today: t, fee }: { subs: Subscription[]; today: string; fee: (s: Subscription) => number }) {
  const rates = useStore((s) => s.settings.rates)
  const markPaid = useStore((s) => s.markSubscriptionPaid)
  const toast = useToast((s) => s.show)
  const [horizon, setHorizon] = useState<'3' | '12'>('3')
  const items = useMemo(() => upcomingPayments(subs, t, addInterval(t, Number(horizon), 'month')), [subs, t, horizon])
  const due = subs.flatMap((s) => dueForPayment(s, t).filter((d) => d < t).map((date) => ({ sub: s, date })))
  const months = useMemo(() => {
    const m = new Map<string, typeof items>()
    for (const i of items) m.set(monthKey(i.date), [...(m.get(monthKey(i.date)) ?? []), i])
    return [...m.entries()]
  }, [items])

  return (
    <>
      <Segmented label="Horizon" value={horizon} onChange={setHorizon} options={[{ value: '3', label: '3 mois' }, { value: '12', label: '12 mois' }]} />
      {due.length > 0 && (
        <Section title="Passés, à enregistrer">
          <div className="card flush"><ul className="list">
            {due.map(({ sub, date }) => (
              <li key={sub.id + date}><div className="row">
                <span className="dot" style={{ background: sub.color, width: 12, height: 12 }} />
                <div className="main"><span className="title">{sub.name}</span><span className="sub">{formatDate(date)}</span></div>
                <button className="btn sm" onClick={() => { markPaid(sub, date); toast(`${sub.name} enregistré dans les opérations`) }}><Check size={16} />Payé</button>
              </div></li>
            ))}
          </ul></div>
        </Section>
      )}
      {months.map(([m, list]) => {
        const total = list.reduce((s, i) => s + paymentXPF(i.sub, rates, fee(i.sub)), 0)
        return (
          <Section key={m} title={<span style={{ textTransform: 'capitalize' }}>{monthLabel(m)}</span>} action={<span className="num" style={{ color: 'var(--text)' }}><Money value={total} approx={list.some((i) => !isExact(i.sub, fee(i.sub)))} /></span>}>
            <div className="card flush"><ul className="list">
              {list.map(({ sub, date }) => {
                const isToday = date === t
                return (
                  <li key={sub.id + date}>
                    <div className="row">
                      <span className="dot" style={{ background: sub.color, width: 12, height: 12 }} />
                      <Link className="main" to={`/abonnements/${sub.id}`} style={{ color: 'inherit' }}>
                        <span className="title">{sub.name}</span>
                        <span className="sub">{formatDate(date)}{isToday ? " · aujourd'hui" : ''}{sub.plan ? ` · ${sub.plan}` : ''}</span>
                      </Link>
                      <div className="end">
                        <Money className="amount" value={paymentXPF(sub, rates, fee(sub))} approx={!isExact(sub, fee(sub))} />
                        {sub.currency !== 'XPF' && <span className="faint">{formatMoney(sub.amount, sub.currency)}</span>}
                      </div>
                      {isToday && <button className="btn sm" onClick={() => { markPaid(sub, date); toast(`${sub.name} enregistré`) }} aria-label={`Marquer ${sub.name} payé`}><Check size={16} /></button>}
                    </div>
                  </li>
                )
              })}
            </ul></div>
          </Section>
        )
      })}
    </>
  )
}

function Report({ subs, fee, monthly, yearly }: { subs: Subscription[]; fee: (s: Subscription) => number; monthly: number; yearly: number }) {
  const rates = useStore((s) => s.settings.rates)
  const accounts = useMap('accounts')
  const active = subs.filter(isActive)
  const monthlyN = active.filter((s) => s.unit !== 'year' && !(s.unit === 'month' && s.every >= 12))
  const yearlyN = active.length - monthlyN.length
  const tags = costByTag(subs, rates)
  const maxTag = Math.max(1, ...tags.map((x) => x.monthly))
  const byAccount = new Map<string, number>()
  for (const s of active) byAccount.set(s.accountId ?? '', (byAccount.get(s.accountId ?? '') ?? 0) + monthlyCost(s, rates, fee(s)))
  const cancelled = subs.filter((s) => s.status === 'cancelled').reduce((sum, s) => sum + monthlyCost({ ...s, status: 'active' }, rates, fee(s)), 0)
  const foreign = active.filter((s) => s.currency !== 'XPF')
  const feesYear = foreign.reduce((sum, s) => sum + (yearlyCost(s, rates, fee(s)) - yearlyCost(s, rates, 0)), 0)

  return (
    <>
      <div className="card kpis">
        <div className="kpi"><span className="label">Par mois</span><Money className="value" value={monthly} /></div>
        <div className="kpi"><span className="label">Par an</span><Money className="value" value={yearly} /></div>
        <div className="kpi"><span className="label">Mensuels · annuels</span><span className="value num">{monthlyN.length} · {yearlyN}</span></div>
        <div className="kpi"><span className="label">En devises</span><span className="value num">{foreign.length}</span></div>
      </div>
      {feesYear > 0 && <div className="callout warn">Frais de change estimés : <strong><Money value={feesYear} approx /></strong> par an sur les abonnements en devises.</div>}
      {cancelled > 0 && <div className="callout">Économies grâce aux résiliations : <strong><Money value={cancelled} /></strong> par mois.</div>}

      <Section title="Par étiquette (coût mensuel)">
        <div className="card hbars">
          {tags.map((x) => (
            <Link key={x.tag} to={`/operations?tag=${encodeURIComponent(x.tag)}`} className="hbar" style={{ gridTemplateColumns: '1fr auto', color: 'inherit' }}>
              <div>
                <div className="lbl"><span>{x.tag} <span className="faint">({x.count} abonnement{x.count > 1 ? 's' : ''})</span></span></div>
                <div className="track"><div className="bar" style={{ width: `${(x.monthly / maxTag) * 100}%`, background: 'var(--chart-income)' }} /></div>
              </div>
              <span className="val num">{formatMoney(x.monthly)}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Par compte de prélèvement (mensuel)">
        <div className="card flush"><ul className="list">
          {[...byAccount.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => (
            <li key={id}><div className="row" style={{ minHeight: 48 }}>
              <span className="main">{accounts.get(id)?.name ?? 'Compte non précisé'}</span>
              <Money className="amount" value={v} />
            </div></li>
          ))}
        </ul></div>
      </Section>
    </>
  )
}
