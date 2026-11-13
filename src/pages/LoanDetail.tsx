import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { useStore } from '../data/store'
import { formatDate, monthLabel, today } from '../lib/dates'
import { dueInstallments, durationLabel, loanStatus, schedule, type Installment } from '../lib/loans'
import { formatMoney } from '../lib/money'
import { Page, Section } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { Money } from '../ui/Money'
import { useToast } from '../ui/toast'

export default function LoanDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loan = useStore((s) => (id ? s.data.loans[id] : undefined))
  const markPaid = useStore((s) => s.markLoanPaid)
  const complet = useStore((s) => s.settings.mode === 'complet')
  const toast = useToast((s) => s.show)
  const [open, setOpen] = useState<number | null>(null)
  const t = today()
  const rows = useMemo(() => (loan ? schedule(loan) : []), [loan])
  const years = useMemo(() => {
    const m = new Map<number, Installment[]>()
    for (const r of rows) m.set(Number(r.date.slice(0, 4)), [...(m.get(Number(r.date.slice(0, 4))) ?? []), r])
    return [...m.entries()]
  }, [rows])

  if (!loan || loan.deleted) {
    return <Page title="Crédit" back><p className="muted">Ce crédit n'existe plus.</p><button className="btn" onClick={() => nav('/prets')}>Retour aux crédits</button></Page>
  }
  const st = loanStatus(loan, t)
  const due = dueInstallments(loan, t)
  const cur = loan.currency
  const f = (n: number) => formatMoney(n, cur)
  const remainingMonths = st.totalCount - st.paidCount

  return (
    <Page title={loan.name} back="/prets" actions={<Link className="icon-btn" to={`/prets/${loan.id}/modifier`} aria-label="Modifier"><Pencil size={20} /></Link>}>
      <div className="card stack" style={{ gap: 14 }}>
        <div className="hero">
          <span className="label">Reste à rembourser au {formatDate(t)}</span>
          <Money className="value" value={st.remaining} currency={cur} />
        </div>
        <Meter value={loan.principal - st.remaining} max={loan.principal} label="Capital remboursé" />
        <span className="faint">{Math.round(st.progress * 100)} % remboursé · {f(loan.principal - st.remaining)} sur {f(loan.principal)}</span>
        <div className="kpis">
          <div className="kpi"><span className="label">Mensualité</span><span className="value num">{f(st.payment + loan.insuranceMonthly)}</span>{loan.insuranceMonthly > 0 && <span className="faint">dont assurance {f(loan.insuranceMonthly)}</span>}</div>
          <div className="kpi"><span className="label">Prochain paiement</span><span className="value num">{st.nextDate ? formatDate(st.nextDate) : '—'}</span></div>
          <div className="kpi"><span className="label">Fin du prêt</span><span className="value num" style={{ textTransform: 'capitalize' }}>{st.endDate ? monthLabel(st.endDate.slice(0, 7)) : '—'}</span>{remainingMonths > 0 && <span className="faint">encore {durationLabel(remainingMonths)}</span>}</div>
          <div className="kpi"><span className="label">Paiements faits</span><span className="value num">{st.paidCount} / {st.totalCount}</span></div>
        </div>
      </div>

      {due.length > 0 && (
        <div className="callout warn" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            {due.length} mensualité{due.length > 1 ? 's' : ''} passée{due.length > 1 ? 's' : ''} pas encore notée(s) dans l'historique
            ({due.slice(-3).map((d) => formatDate(d.date)).join(', ')}{due.length > 3 ? '…' : ''})
          </span>
          <button className="btn sm" onClick={() => {
            for (const d of due) markPaid(useStore.getState().data.loans[loan.id], d)
            toast(`${due.length} mensualité(s) notée(s)`)
          }}><Check size={16} />Payé</button>
        </div>
      )}

      <details className="more-options" open={complet}>
        <summary>Voir le détail (coût du crédit, calendrier des remboursements)</summary>
        <div className="stack" style={{ gap: 24 }}>
      <Section title="Coût du crédit">
        <div className="card stack" style={{ gap: 8 }}>
          <div className="split"><span className="muted">Capital emprunté</span><span className="num">{f(loan.principal)}</span></div>
          <div className="split"><span className="muted">Intérêts au total</span><span className="num">{f(st.totalInterest)}</span></div>
          {st.totalInsurance > 0 && <div className="split"><span className="muted">Assurance au total</span><span className="num">{f(st.totalInsurance)}</span></div>}
          <div className="split"><strong>Coût total du crédit</strong><strong className="num">{f(st.totalInterest + st.totalInsurance)}</strong></div>
          <div className="split faint"><span>Intérêts déjà payés</span><span className="num">{f(st.interestPaid)}</span></div>
          {loan.extraRepayments.length > 0 && (
            <div className="split faint"><span>Remboursements anticipés</span><span className="num">{f(loan.extraRepayments.reduce((a, e) => a + e.amount, 0))}</span></div>
          )}
        </div>
      </Section>

      <Section title="Calendrier des remboursements">
        <div className="card flush">
          {years.map(([y, list]) => {
            const isOpen = open === y || (open === null && y === Number(t.slice(0, 4)))
            const sum = (k: 'interest' | 'principal') => list.reduce((a, r) => a + r[k], 0)
            return (
              <div key={y}>
                <button className="row" onClick={() => setOpen(isOpen ? -1 : y)} aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <div className="main">
                    <span className="title">{y}</span>
                    <span className="sub">{list.length} éch. · intérêts {f(sum('interest'))}</span>
                  </div>
                  <div className="end"><span className="faint">reste fin {y}</span><span className="num">{f(list[list.length - 1].remaining)}</span></div>
                </button>
                {isOpen && (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Date</th><th className="r hide-sm">Mensualité</th><th className="r">Intérêts</th><th className="r">Capital</th><th className="r">Restant</th></tr></thead>
                      <tbody>
                        {list.map((r) => {
                          const paid = r.date <= t
                          return (
                            <tr key={r.n} style={paid ? { color: 'var(--text-2)' } : undefined}>
                              <td className="num">
                                {formatDate(r.date).slice(0, 5)}{paid ? ' ✓' : ''}
                                {r.extra ? <div><span className="badge primary">anticipé +{f(r.extra)}</span></div> : null}
                              </td>
                              <td className="r num hide-sm">{f(r.total)}</td>
                              <td className="r num">{f(r.interest)}</td>
                              <td className="r num">{f(r.principal)}</td>
                              <td className="r num">{f(r.remaining)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
        </div>
        {loan.notes && <p className="muted">{loan.notes}</p>}
        <p className="faint" style={{ margin: 0 }}>Calcul théorique (prêt amortissable à mensualités constantes). Comparez avec le tableau d'amortissement de votre banque : en cas d'écart, ajustez le taux ou ajoutez un remboursement anticipé.</p>
      </details>
    </Page>
  )
}
