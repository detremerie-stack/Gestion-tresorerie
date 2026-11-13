import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useList, useMap, useStore } from '../data/store'
import { COMMON, useMembers } from '../data/hooks'
import { addMonths, monthKey, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { byCategory, byMonth, signedXPF, totals } from '../lib/reports'
import { Page, Section } from '../ui/Page'
import { MonthColumns, RankedBars } from '../ui/Charts'
import { Segmented } from '../ui/Field'
import { Money } from '../ui/Money'

type Period = '1' | '3' | '6' | '12'

export default function Reports() {
  const nav = useNavigate()
  const [period, setPeriod] = useState<Period>('6')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const txs = useList('transactions')
  const accounts = useMap('accounts')
  const cats = useMap('categories')
  const members = useMembers()
  const rates = useStore((s) => s.settings.rates)
  const current = monthKey(today())
  const months = useMemo(() => Array.from({ length: Number(period) }, (_, i) => addMonths(current, i - Number(period) + 1)), [period, current])
  const inPeriod = useMemo(() => txs.filter((t) => months.includes(monthKey(t.date))), [txs, months])
  const tot = totals(inPeriod, accounts, rates)
  const cat = byCategory(inPeriod, accounts, rates, kind)
  const monthly = byMonth(txs, accounts, rates, Number(period) < 6 ? Array.from({ length: 6 }, (_, i) => addMonths(current, i - 5)) : months)
  const savingRate = tot.income > 0 ? Math.round((tot.net / tot.income) * 100) : null
  const n = Number(period)

  const perMember = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inPeriod) {
      if (t.type !== 'expense') continue
      const k = t.member ?? COMMON
      m.set(k, (m.get(k) ?? 0) - signedXPF(t, accounts, rates))
    }
    return m
  }, [inPeriod, accounts, rates])

  return (
    <Page title="Rapports" back wide>
      <Segmented label="Période" value={period} onChange={setPeriod} options={[{ value: '1', label: 'Ce mois' }, { value: '3', label: '3 mois' }, { value: '6', label: '6 mois' }, { value: '12', label: '12 mois' }]} />

      <div className="card kpis">
        <div className="kpi"><span className="label">Revenus</span><Money className="value" value={tot.income} /></div>
        <div className="kpi"><span className="label">Dépenses</span><Money className="value" value={tot.expense} /></div>
        <div className="kpi"><span className="label">Solde</span><Money className="value" value={tot.net} sign tone /></div>
        <div className="kpi"><span className="label">Taux d'épargne</span><span className="value num">{savingRate == null ? '—' : `${savingRate} %`}</span></div>
        {n > 1 && <div className="kpi"><span className="label">Dépenses / mois</span><Money className="value" value={Math.round(tot.expense / n)} /></div>}
      </div>

      <Section title="Évolution mensuelle">
        <div className="card"><MonthColumns data={monthly} /></div>
      </Section>

      <Section title="Par catégorie">
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Dépenses' }, { value: 'income', label: 'Revenus' }]} />
        <div className="card">
          {cat.length === 0 ? <p className="muted" style={{ margin: 0 }}>Rien sur cette période.</p> : (
            <RankedBars kind={kind} onSelect={(id) => nav(`/operations?cat=${id || 'none'}`)}
              items={cat.map((c) => {
                const k = cats.get(c.categoryId)
                return { key: c.categoryId, label: k?.name ?? 'Sans catégorie', value: c.total, icon: k?.icon, color: k?.color, sub: n > 1 ? `${formatMoney(Math.round(c.total / n))}/mois` : undefined }
              })} />
          )}
        </div>
      </Section>

      {perMember.size > 0 && (
        <Section title="Dépenses par personne">
          <div className="card flush"><ul className="list">
            {[...members.map((m) => [m.id, m.name] as const), [COMMON, 'Commun'] as const].filter(([id]) => perMember.has(id)).map(([id, name]) => (
              <li key={id}><div className="row" style={{ minHeight: 48 }}><span className="main">{name}</span><Money className="amount" value={perMember.get(id)!} /></div></li>
            ))}
          </ul></div>
        </Section>
      )}
    </Page>
  )
}
