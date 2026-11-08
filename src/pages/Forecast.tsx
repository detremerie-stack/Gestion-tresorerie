import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Plus, Sparkles } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useBalances, useMemberName } from '../data/hooks'
import { useForecast } from '../data/useForecast'
import type { Planned } from '../data/types'
import { addInterval, formatDate, monthLabel, split, today } from '../lib/dates'
import { detectRecurring, plannedOccurrences } from '../lib/forecast'
import { normalize } from '../lib/id'
import { formatMoney, parseAmount } from '../lib/money'
import { cycleLabel } from '../lib/subscriptions'
import { Page, Section } from '../ui/Page'
import { Segmented } from '../ui/Field'
import { Money } from '../ui/Money'
import { BalanceBars } from '../ui/Charts'
import { useToast } from '../ui/toast'

export default function Forecast() {
  const t = today()
  const [horizon, setHorizon] = useState<'3' | '6' | '12'>('6')
  const rates = useStore((s) => s.settings.rates)
  const override = useStore((s) => s.settings.forecastVariable)
  const setSettings = useStore((s) => s.setSettings)
  const upsert = useStore((s) => s.upsert)
  const toast = useToast((s) => s.show)
  const accounts = useMap('accounts')
  const cats = useMap('categories')
  const txs = useList('transactions')
  const planned = useList('planned')
  const balances = useBalances()
  const memberName = useMemberName()
  const [editVar, setEditVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')

  const { rows, estimated, variable } = useForecast(Number(horizon))

  const low = rows.reduce((m, r) => (r.endBalance < m.endBalance ? r : m), rows[0])
  const end = rows[rows.length - 1]

  const suggestions = useMemo(() => {
    const known = new Set(planned.map((p) => normalize(p.name)))
    return detectRecurring(txs, t, accounts, rates).filter((c) => !known.has(normalize(c.name))).slice(0, 8)
  }, [txs, t, accounts, rates, planned])

  const addSuggestion = (c: (typeof suggestions)[number]) => {
    const [y, m] = split(t)
    const day = Math.min(c.day, 28)
    let start = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (start <= t) start = addInterval(start, 1, 'month')
    upsert('planned', { name: c.name, kind: c.kind, amount: c.amount, currency: 'XPF', unit: 'month', every: 1, startDate: start, categoryId: c.categoryId, accountId: c.accountId, member: c.member, active: true })
    toast(`« ${c.name} » ajouté aux prévisions`)
  }

  const sorted = [...planned].sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind === 'income' ? -1 : 1))
  const nextOf = (p: Planned) => plannedOccurrences(p, t, addInterval(t, 2, 'year'))[0]

  return (
    <Page title="Prévisionnel" back>
      <Segmented label="Horizon" value={horizon} onChange={setHorizon} options={[{ value: '3', label: '3 mois' }, { value: '6', label: '6 mois' }, { value: '12', label: '12 mois' }]} />
      <div className="card kpis">
        <div className="kpi"><span className="label">Aujourd'hui</span><Money className="value" value={balances.total} approx={balances.approx} /></div>
        <div className="kpi"><span className="label">Fin {monthLabel(end.month, true)}</span><Money className={`value ${end.endBalance < 0 ? 'expense' : ''}`} value={end.endBalance} approx /></div>
        <div className="kpi"><span className="label">Point bas</span><Money className={`value ${low.endBalance < 0 ? 'expense' : ''}`} value={low.endBalance} approx /><span className="faint" style={{ textTransform: 'capitalize' }}>fin {monthLabel(low.month)}</span></div>
        <div className="kpi"><span className="label">Dépenses courantes / mois</span>
          {editVar ? (
            <span className="input-group">
              <input className="input" inputMode="numeric" value={varDraft} onChange={(e) => setVarDraft(e.target.value)} aria-label="Dépenses courantes par mois" autoFocus />
              <button className="btn sm primary" onClick={() => { const v = parseAmount(varDraft); setSettings({ forecastVariable: v > 0 ? Math.round(v) : undefined }); setEditVar(false) }}>OK</button>
            </span>
          ) : (
            <button className="btn sm" style={{ border: 0, padding: 0, justifyContent: 'flex-start' }} onClick={() => { setVarDraft(String(variable)); setEditVar(true) }}>
              <Money className="value" value={variable} />
            </button>
          )}
          <span className="faint">{override != null ? <>fixé · <button className="btn sm" style={{ border: 0, padding: 0, minHeight: 0 }} onClick={() => setSettings({ forecastVariable: undefined })}>moyenne : {formatMoney(estimated)}</button></> : 'moyenne des 3 derniers mois'}</span>
        </div>
      </div>
      {low.endBalance < 0 && (
        <div className="callout warn"><AlertTriangle size={18} /><span>Le solde passerait <strong>sous zéro</strong> fin {monthLabel(low.month)} ({formatMoney(low.endBalance)}). Réduisez les dépenses ou décalez une dépense prévue.</span></div>
      )}

      <Section title="Solde prévu en fin de mois">
        <div className="card"><BalanceBars data={rows.map((r) => ({ month: r.month, value: r.endBalance }))} /></div>
      </Section>

      <Section title="Détail par mois">
        <div className="card flush table-wrap">
          <table className="data">
            <thead><tr><th>Mois</th><th className="r">Entrées</th><th className="r">Sorties</th><th className="r">Solde fin</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const out = r.subscriptions + r.loans + r.planned + r.trips + r.variable
                return (
                  <tr key={r.month}>
                    <td style={{ textTransform: 'capitalize' }}>
                      {monthLabel(r.month, true)}
                      <div className="faint" style={{ fontSize: 12 }}>
                        {[r.subscriptions && `abo. ${formatMoney(r.subscriptions)}`, r.loans && `prêts ${formatMoney(r.loans)}`, r.planned && `prévu ${formatMoney(r.planned)}`, r.trips && `voyages ${formatMoney(r.trips)}`, r.variable && `courant ${formatMoney(r.variable)}`].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="r num income">{formatMoney(r.income, 'XPF', { sign: true })}</td>
                    <td className="r num expense">{formatMoney(-out)}</td>
                    <td className={`r num ${r.endBalance < 0 ? 'expense' : ''}`}><strong>{formatMoney(r.endBalance)}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ margin: 0 }}>Estimation : soldes actuels + prévisions + abonnements + échéances de prêts + budgets voyages restants − dépenses courantes. Les virements entre vos comptes ne changent pas le total.</p>
      </Section>

      <Section title="Entrées et sorties prévues" action={<Link to="/previsionnel/nouveau">Ajouter</Link>}>
        <div className="card flush">
          <ul className="list">
            {sorted.map((p) => {
              const next = nextOf(p)
              return (
                <li key={p.id}>
                  <Link className="row" to={`/previsionnel/${p.id}`} style={{ color: 'inherit', opacity: p.active ? 1 : 0.55 }}>
                    <div className="main">
                      <span className="title">{p.name}</span>
                      <span className="sub">
                        {[p.unit === 'once' ? 'Une fois' : cycleLabel({ every: p.every, unit: p.unit }), next ? `prochain ${formatDate(next)}` : 'terminé', cats.get(p.categoryId ?? '')?.name, memberName(p.member)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <Money className={`amount ${p.kind}`} value={p.kind === 'income' ? p.amount : -p.amount} currency={p.currency} sign={p.kind === 'income'} />
                  </Link>
                </li>
              )
            })}
            {sorted.length === 0 && <li className="row muted">Aucune prévision. Ajoutez vos salaires, la pension, les impôts, la rentrée scolaire…</li>}
          </ul>
        </div>
        <Link className="btn" to="/previsionnel/nouveau"><Plus size={18} />Nouvelle prévision</Link>
      </Section>

      {suggestions.length > 0 && (
        <Section title="Détectés dans vos opérations">
          <div className="card flush">
            <ul className="list">
              {suggestions.map((c) => (
                <li key={c.key}>
                  <div className="row">
                    <Sparkles size={18} className="faint" aria-hidden />
                    <div className="main"><span className="title">{c.name}</span><span className="sub">{c.months} mois sur 4 · vers le {c.day} · {c.kind === 'income' ? 'entrée' : 'sortie'}</span></div>
                    <Money className={`amount ${c.kind}`} value={c.kind === 'income' ? c.amount : -c.amount} sign={c.kind === 'income'} />
                    <button className="btn sm" onClick={() => addSuggestion(c)} aria-label={`Ajouter ${c.name}`}><Plus size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </Page>
  )
}
