import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { COMMON, useAccounts, useCategories, useMembers } from '../data/hooks'
import type { Planned } from '../data/types'
import { today, type IntervalUnit } from '../lib/dates'
import { CURRENCIES, parseAmount, type Currency } from '../lib/money'
import { Page } from '../ui/Page'
import { Field, Segmented, SelectField, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

export default function PlannedForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.planned[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const currentMember = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()

  const [kind, setKind] = useState<Planned['kind']>(existing?.kind ?? 'expense')
  const [name, setName] = useState(existing?.name ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '')
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'XPF')
  const [unit, setUnit] = useState<Planned['unit']>(existing?.unit ?? 'month')
  const [every, setEvery] = useState(existing?.every ?? 1)
  const [startDate, setStartDate] = useState(existing?.startDate ?? today())
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '')
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '')
  const [member, setMember] = useState(existing?.member ?? currentMember ?? COMMON)
  const [active, setActive] = useState(existing?.active ?? true)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string>()

  const save = () => {
    const v = parseAmount(amount)
    if (!name.trim()) return setError('Donnez un nom (ex. Salaire Véra, Impôt foncier, Rentrée scolaire).')
    if (!(v > 0)) return setError('Indiquez un montant.')
    upsert('planned', {
      ...(existing ?? {}), id: existing?.id, name: name.trim(), kind, amount: v, currency, unit, every: unit === 'once' ? 1 : Math.max(1, every),
      startDate, endDate: endDate || undefined, categoryId: categoryId || undefined, accountId: accountId || undefined, member, active, notes: notes.trim() || undefined,
    })
    toast(existing ? 'Prévision modifiée' : 'Prévision ajoutée')
    nav(-1)
  }

  return (
    <Page title={existing ? 'Modifier la prévision' : 'Nouvelle prévision'} back actions={existing && (
      <button className="icon-btn" aria-label="Supprimer" onClick={() => { remove('planned', existing.id); toast('Prévision supprimée', { label: 'Annuler', run: () => upsert('planned', { ...existing, deleted: false }) }); nav(-1) }}><Trash2 size={20} /></button>
    )}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setCategoryId('') }} options={[{ value: 'expense', label: 'Sortie' }, { value: 'income', label: 'Entrée' }]} />
        <TextField label="Nom" value={name} onChange={(v) => { setName(v); setError(undefined) }} placeholder={kind === 'income' ? 'Salaire Lionel, Allocations…' : 'Pension alimentaire, Impôt, Assurance auto…'} error={error} autoFocus={!existing} />
        <Field label="Montant">
          <div className="input-group">
            <input className="input big" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Montant" />
            <select className="input" aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </Field>
        <div className="field">
          <span className="label">Fréquence</span>
          <div className="chips">
            {([['once', 1, 'Une fois'], ['month', 1, 'Mensuel'], ['month', 3, 'Trimestriel'], ['year', 1, 'Annuel']] as const).map(([u, n, l]) => (
              <button key={l} type="button" className="chip" aria-pressed={unit === u && (u === 'once' || every === n)} onClick={() => { setUnit(u); setEvery(n) }}>{l}</button>
            ))}
          </div>
          {unit !== 'once' && (
            <div className="input-group">
              <input className="input" type="number" min={1} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} aria-label="Tous les" style={{ maxWidth: 90 }} />
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as IntervalUnit)} aria-label="Unité" style={{ flex: 1, width: '100%' }}>
                <option value="week">semaine(s)</option><option value="month">mois</option><option value="year">an(s)</option>
              </select>
            </div>
          )}
        </div>
        <div className="grid-2">
          <TextField label={unit === 'once' ? 'Date' : 'Première date'} type="date" value={startDate} onChange={setStartDate} />
          {unit !== 'once' && <TextField label="Jusqu'au (facultatif)" type="date" value={endDate} onChange={setEndDate} />}
        </div>
        <SelectField label="Catégorie" value={categoryId} onChange={setCategoryId} options={[{ value: '', label: 'Aucune' }, ...categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.name }))]}
          hint={kind === 'expense' ? 'Les opérations de cette catégorie ne sont plus comptées dans les « dépenses courantes » du prévisionnel (pas de double compte).' : undefined} />
        <SelectField label="Compte" value={accountId} onChange={setAccountId} options={[{ value: '', label: 'Non précisé' }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))]} />
        <div className="field">
          <span className="label">Pour qui</span>
          <Segmented label="Membre" value={member} onChange={setMember} options={[...members.map((m) => ({ value: m.id, label: m.name })), { value: COMMON, label: 'Commun' }]} />
        </div>
        <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Prise en compte dans le prévisionnel</label>
        <TextField label="Notes" value={notes} onChange={setNotes} placeholder="Facultatif" />
        <div className="sticky-actions"><button className="btn primary" type="submit">Enregistrer</button></div>
      </form>
    </Page>
  )
}
