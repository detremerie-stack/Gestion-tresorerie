import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { formatDate, formatShortDate } from '../lib/dates'
import { formatMoney, toXPF } from '../lib/money'
import { Page, Section } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { Money } from '../ui/Money'
import { CatIcon } from '../ui/Icon'
import { useTripStatuses } from './Trips'

export default function TripDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const rows = useTripStatuses()
  const row = rows.find((r) => r.trip.id === id)
  const txs = useList('transactions')
  const accounts = useMap('accounts')
  const cats = useMap('categories')
  const rates = useStore((s) => s.settings.rates)
  if (!row) return <Page title="Voyage" back><p className="muted">Ce voyage n'existe plus.</p><button className="btn" onClick={() => nav('/voyages')}>Voyages</button></Page>
  const { trip, st } = row
  const linked = txs.filter((t) => t.tripId === trip.id).sort((a, b) => b.date.localeCompare(a.date))
  const savings = accounts.get(trip.savingsAccountId ?? '')
  const byLine = (label: string) => linked.filter((t) => t.note === label || t.tags.includes(label)).reduce((s, t) => s + toXPF(t.amount, accounts.get(t.accountId)?.currency ?? 'XPF', rates), 0)

  return (
    <Page title={trip.name} back="/voyages" actions={<Link className="icon-btn" to={`/voyages/${trip.id}/modifier`} aria-label="Modifier"><Pencil size={20} /></Link>}>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="split" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="faint">{[trip.destination, `${formatDate(trip.startDate)} → ${formatDate(trip.endDate)}`].filter(Boolean).join(' · ')}</div>
            <div className="hero"><span className="label">Budget du voyage</span><Money className="value" value={st.budget} /></div>
          </div>
          {st.phase === 'avant' && <div style={{ textAlign: 'right' }}><strong className="num" style={{ fontSize: 28 }}>J−{st.daysToGo}</strong><div className="faint">avant le départ</div></div>}
        </div>
        <Meter value={st.spent} max={st.budget} label="Budget dépensé" />
        <div className="kpis">
          <div className="kpi"><span className="label">Dépensé</span><Money className="value" value={st.spent} /></div>
          <div className="kpi"><span className="label">Reste</span><Money className="value" value={st.remaining} /></div>
          {savings && <div className="kpi"><span className="label">Mis de côté ({savings.name})</span><Money className="value" value={st.saved} approx={savings.currency !== 'XPF' && savings.currency !== 'EUR'} /></div>}
          {st.phase === 'avant' && <div className="kpi"><span className="label">À épargner</span><span className="value num">{st.toSave > 0 ? `${formatMoney(st.perMonth)}/mois` : 'Couvert ✓'}</span>{st.toSave > 0 && <span className="faint">{formatMoney(st.toSave)} sur {st.monthsToGo || 1} mois</span>}</div>}
        </div>
        {savings && <p className="faint" style={{ margin: 0 }}>L'épargne affichée est le solde du compte {savings.name}, qui peut servir à plusieurs projets.</p>}
      </div>

      <Section title="Budget par poste">
        <div className="card flush"><ul className="list">
          {trip.budgetLines.map((l) => {
            const spent = byLine(l.label)
            return (
              <li key={l.id}><div className="row" style={{ minHeight: 52 }}>
                <span className="main"><span className="title">{l.label}</span>{spent > 0 && <span className="sub">dépensé {formatMoney(spent)}</span>}</span>
                <span className="end"><Money className="amount" value={l.amount} currency={l.currency} />{l.currency !== 'XPF' && <span className="faint">{formatMoney(toXPF(l.amount, l.currency, rates))}</span>}</span>
              </div></li>
            )
          })}
          {trip.budgetLines.length === 0 && <li className="row muted">Aucun poste. Modifiez le voyage pour ajouter billets, hébergement…</li>}
        </ul></div>
      </Section>

      <Section title={`Dépenses du voyage (${linked.length})`} action={<Link to={`/operations/nouvelle?type=expense&voyage=${trip.id}`}>Ajouter</Link>}>
        <div className="card flush"><ul className="list">
          {linked.map((t) => {
            const cat = cats.get(t.categoryId ?? '')
            const acc = accounts.get(t.accountId)
            return (
              <li key={t.id}><Link className="row" to={`/operations/${t.id}`} style={{ color: 'inherit' }}>
                <CatIcon icon={cat?.icon} color={cat?.color} small />
                <span className="main"><span className="title">{t.payee || cat?.name || 'Dépense'}</span><span className="sub">{formatShortDate(t.date)} · {acc?.name}{t.note ? ` · ${t.note}` : ''}</span></span>
                <span className="end"><Money className="amount expense" value={-t.amount} currency={acc?.currency} />{t.originalCurrency && <span className="faint">{formatMoney(t.originalAmount ?? 0, t.originalCurrency)}</span>}</span>
              </Link></li>
            )
          })}
          {linked.length === 0 && <li className="row muted">Rattachez une dépense à ce voyage depuis le formulaire d'opération (champ « Voyage »).</li>}
        </ul></div>
        <Link className="btn" to={`/operations/nouvelle?type=expense&voyage=${trip.id}`}><Plus size={18} />Dépense pour ce voyage</Link>
      </Section>
      {trip.notes && <p className="muted">{trip.notes}</p>}
    </Page>
  )
}
