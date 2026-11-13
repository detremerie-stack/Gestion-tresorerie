import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, Plus } from 'lucide-react'
import { useList, useStore } from '../data/store'
import { formatDate, monthLabel, today } from '../lib/dates'
import { durationLabel, loanStatus } from '../lib/loans'
import { isFixedRate, toXPF } from '../lib/money'
import { Empty, Page } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { Money } from '../ui/Money'

export default function Loans() {
  const loans = useList('loans')
  const rates = useStore((s) => s.settings.rates)
  const t = today()
  const rows = useMemo(() => loans.map((l) => ({ l, st: loanStatus(l, t) })).sort((a, b) => b.st.remaining - a.st.remaining), [loans, t])
  const active = rows.filter((r) => r.st.remaining > 0)
  const totalRemaining = active.reduce((s, r) => s + toXPF(r.st.remaining, r.l.currency, rates), 0)
  const totalMonthly = active.reduce((s, r) => s + toXPF(r.st.payment + r.l.insuranceMonthly, r.l.currency, rates), 0)
  const approx = active.some((r) => !isFixedRate(r.l.currency))

  return (
    <Page title="Crédits" back actions={<Link className="icon-btn" to="/prets/nouveau" aria-label="Ajouter un crédit"><Plus /></Link>}>
      {rows.length === 0 ? (
        <Empty icon={<Landmark size={40} />} title="Aucun crédit">
          <span>Crédit immobilier, auto, conso… voyez ce qu'il reste à rembourser et jusqu'à quand.</span>
          <Link className="btn primary" to="/prets/nouveau"><Plus size={18} />Ajouter un crédit</Link>
        </Empty>
      ) : (
        <>
          <div className="card kpis">
            <div className="kpi"><span className="label">Reste à rembourser</span><Money className="value" value={totalRemaining} approx={approx} /></div>
            <div className="kpi"><span className="label">Par mois</span><Money className="value" value={totalMonthly} approx={approx} /></div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {rows.map(({ l, st }) => (
              <Link key={l.id} to={`/prets/${l.id}`} className="card stack" style={{ color: 'inherit', borderLeft: `6px solid ${l.color}`, gap: 10 }}>
                <div className="split" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: 17 }}>{l.name}</strong>
                    <div className="faint">{[l.lender, `${String(l.annualRate).replace('.', ',')} %`, durationLabel(l.termMonths)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Money className="num" value={st.payment + l.insuranceMonthly} currency={l.currency} />
                    <div className="faint">par mois</div>
                  </div>
                </div>
                <Meter value={l.principal - st.remaining} max={l.principal} label={`Remboursé ${l.name}`} />
                <div className="split faint">
                  {st.remaining > 0 ? (
                    <>
                      <span>Reste <Money value={st.remaining} currency={l.currency} /> · {Math.round(st.progress * 100)} % remboursé</span>
                      <span>Fin {st.endDate ? monthLabel(st.endDate.slice(0, 7), true) : '—'}</span>
                    </>
                  ) : (
                    <span className="income">Soldé{st.endDate ? ` le ${formatDate(st.endDate)}` : ''} ✓</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}
