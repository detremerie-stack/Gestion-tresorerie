import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../data/store'
import { useAccounts } from '../data/hooks'
import { PALETTE } from '../data/defaults'
import type { TripLine } from '../data/types'
import { addInterval, today } from '../lib/dates'
import { uid } from '../lib/id'
import { CURRENCIES, formatMoney, parseAmount, toXPF, type Currency } from '../lib/money'
import { Page } from '../ui/Page'
import { Field, SelectField, Swatches, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

const PRESETS = ["Billets d'avion", 'Hébergement', 'Location de voiture', 'Repas', 'Activités', 'Shopping', 'Assurance voyage', 'Transport sur place']
type Draft = { id: string; label: string; amount: string; currency: Currency }

export default function TripForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.trips[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const rates = useStore((s) => s.settings.rates)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const deblock = accounts.find((a) => a.institution === 'deblock')

  const [name, setName] = useState(existing?.name ?? '')
  const [destination, setDestination] = useState(existing?.destination ?? '')
  const [startDate, setStartDate] = useState(existing?.startDate ?? addInterval(today(), 3, 'month'))
  const [endDate, setEndDate] = useState(existing?.endDate ?? addInterval(today(), 3, 'month'))
  const [savingsAccountId, setSavings] = useState(existing?.savingsAccountId ?? deblock?.id ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[10])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [tripCurrency, setTripCurrency] = useState<Currency>(existing?.currency ?? 'EUR')
  const [cardAccountId, setCardAccountId] = useState(existing?.cardAccountId ?? accounts.find((a) => a.institution === 'amex')?.id ?? '')
  const [lines, setLines] = useState<Draft[]>(existing?.budgetLines.map((l) => ({ ...l, amount: String(l.amount).replace('.', ',') })) ?? [])
  const [error, setError] = useState<string>()

  const total = lines.reduce((s, l) => s + (parseAmount(l.amount) > 0 ? toXPF(parseAmount(l.amount), l.currency, rates) : 0), 0)
  const setLine = (i: number, p: Partial<Draft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)))

  const save = () => {
    if (!name.trim()) return setError('Donnez un nom au voyage.')
    if (endDate < startDate) return setError('La date de retour est avant le départ.')
    const budgetLines: TripLine[] = lines.filter((l) => l.label.trim() && parseAmount(l.amount) > 0).map((l) => ({ id: l.id, label: l.label.trim(), amount: parseAmount(l.amount), currency: l.currency }))
    const saved = upsert('trips', { ...(existing ?? {}), id: existing?.id, name: name.trim(), destination: destination.trim() || undefined, startDate, endDate, savingsAccountId: savingsAccountId || undefined, color, notes: notes.trim() || undefined, budgetLines, currency: tripCurrency, cardAccountId: cardAccountId || undefined })
    toast(existing ? 'Voyage modifié' : 'Voyage créé')
    nav(`/voyages/${saved.id}`, { replace: true })
  }

  return (
    <Page title={existing ? 'Modifier le voyage' : 'Préparer un voyage'} back actions={existing && (
      <button className="icon-btn" aria-label="Supprimer" onClick={() => { remove('trips', existing.id); toast('Voyage supprimé', { label: 'Annuler', run: () => upsert('trips', { ...existing, deleted: false }) }); nav('/voyages') }}><Trash2 size={20} /></button>
    )}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <TextField label="Nom" value={name} onChange={(v) => { setName(v); setError(undefined) }} placeholder="Vacances en France, Bora Bora…" error={error} autoFocus={!existing} />
        <TextField label="Destination" value={destination} onChange={setDestination} placeholder="Facultatif" />
        <div className="grid-2">
          <TextField label="Date de départ" type="date" value={startDate} onChange={(v) => { setStartDate(v); if (endDate < v) setEndDate(v) }} />
          <TextField label="Date de retour" type="date" value={endDate} onChange={setEndDate} />
        </div>
        <div className="field">
          <span className="label">Budget par poste · total {formatMoney(total)}</span>
          {lines.map((l, i) => (
            <div key={l.id} className="input-group">
              <input className="input" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} aria-label="Poste" placeholder="Poste" />
              <input className="input" inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} aria-label="Montant" placeholder="0" style={{ maxWidth: 110 }} />
              <select className="input" value={l.currency} onChange={(e) => setLine(i, { currency: e.target.value as Currency })} aria-label="Devise">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setLines(lines.filter((_, j) => j !== i))}><X size={18} /></button>
            </div>
          ))}
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {PRESETS.filter((p) => !lines.some((l) => l.label === p)).map((p) => (
              <button key={p} type="button" className="chip" onClick={() => setLines([...lines, { id: uid(), label: p, amount: '', currency: p === "Billets d'avion" ? 'XPF' : 'EUR' }])}>+ {p}</button>
            ))}
            <button type="button" className="chip" onClick={() => setLines([...lines, { id: uid(), label: '', amount: '', currency: 'XPF' }])}><Plus size={14} />Autre</button>
          </div>
        </div>
        <div className="grid-2">
          <SelectField label="Devise sur place" value={tripCurrency} onChange={setTripCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} />
          <SelectField label="Carte utilisée" value={cardAccountId} onChange={setCardAccountId} options={[{ value: '', label: '—' }, ...accounts.map((a) => ({ value: a.id, label: a.name.replace(/\s*\(.*\)/, '') }))]} />
        </div>
        <p className="faint" style={{ margin: 0 }}>Pendant le voyage, « Dépense rapide » passe en mode voyage : devise sur place, carte, rattachement au voyage et conversion au taux du jour.</p>
        <SelectField label="Épargne mise de côté sur" value={savingsAccountId} onChange={setSavings}
          options={[{ value: '', label: 'Aucun compte dédié' }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))]}
          hint="Le solde de ce compte est compté comme déjà épargné pour le voyage." />
        <div className="field"><span className="label">Couleur</span><Swatches value={color} onChange={setColor} colors={PALETTE} /></div>
        <Field label="Notes"><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vols, réservations, idées…" /></Field>
        <div className="sticky-actions"><button className="btn primary" type="submit">Enregistrer</button></div>
      </form>
    </Page>
  )
}
