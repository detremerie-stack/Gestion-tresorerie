import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plane, Plus } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useBalances } from '../data/hooks'
import { formatDate, today } from '../lib/dates'
import { tripStatus } from '../lib/forecast'
import { formatMoney } from '../lib/money'
import { Empty, Page, Section } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { Money } from '../ui/Money'

export function useTripStatuses() {
  const trips = useList('trips')
  const txs = useList('transactions')
  const accounts = useMap('accounts')
  const rates = useStore((s) => s.settings.rates)
  const balances = useBalances()
  const t = today()
  return useMemo(() => trips
    .map((trip) => {
      const saved = balances.rows.find((r) => r.account.id === trip.savingsAccountId)?.xpf ?? 0
      return { trip, st: tripStatus(trip, txs, accounts, rates, t, Math.max(0, saved)) }
    })
    .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)), [trips, txs, accounts, rates, t, balances.rows])
}

export default function Trips() {
  const rows = useTripStatuses()
  const upcoming = rows.filter((r) => r.st.phase !== 'après')
  const past = rows.filter((r) => r.st.phase === 'après').reverse()
  return (
    <Page title="Voyages" back actions={<Link className="icon-btn" to="/voyages/nouveau" aria-label="Préparer un voyage"><Plus /></Link>}>
      {rows.length === 0 ? (
        <Empty icon={<Plane size={40} />} title="Aucun voyage prévu">
          <span>Préparez un voyage : budget par poste (billets, hébergement…), épargne à mettre de côté chaque mois, dépenses sur place.</span>
          <Link className="btn primary" to="/voyages/nouveau"><Plus size={18} />Préparer un voyage</Link>
        </Empty>
      ) : (
        <>
          {upcoming.map(({ trip, st }) => <TripCard key={trip.id} trip={trip} st={st} />)}
          {past.length > 0 && (
            <Section title="Voyages passés">
              {past.map(({ trip, st }) => <TripCard key={trip.id} trip={trip} st={st} />)}
            </Section>
          )}
        </>
      )}
    </Page>
  )
}

function TripCard({ trip, st }: ReturnType<typeof useTripStatuses>[number]) {
  return (
    <Link to={`/voyages/${trip.id}`} className="card stack" style={{ color: 'inherit', borderLeft: `6px solid ${trip.color}`, gap: 10 }}>
      <div className="split" style={{ alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: 17 }}>{trip.name}</strong>
          <div className="faint">{[trip.destination, `${formatDate(trip.startDate)} → ${formatDate(trip.endDate)}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {st.phase === 'avant' ? <><strong className="num" style={{ fontSize: 20 }}>J−{st.daysToGo}</strong><div className="faint">départ</div></>
            : st.phase === 'pendant' ? <span className="badge primary">En cours</span> : <span className="badge">Terminé</span>}
        </div>
      </div>
      <Meter value={st.spent} max={st.budget} label={`Budget ${trip.name}`} />
      <div className="split faint">
        <span>Dépensé <Money value={st.spent} /> / <Money value={st.budget} /></span>
        {st.phase === 'avant' && st.toSave > 0 && <span>À épargner {formatMoney(st.perMonth)}/mois</span>}
        {st.phase === 'avant' && st.toSave === 0 && st.budget > 0 && <span className="income">Budget couvert ✓</span>}
      </div>
    </Link>
  )
}
