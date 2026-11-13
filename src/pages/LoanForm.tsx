import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../data/store'
import { COMMON, useAccounts, useCategories, useMembers } from '../data/hooks'
import { PALETTE } from '../data/defaults'
import type { Loan } from '../data/types'
import { today } from '../lib/dates'
import { CURRENCIES, formatMoney, parseAmount, type Currency } from '../lib/money'
import { durationLabel, loanStatus, monthlyPayment, schedule } from '../lib/loans'
import { Page } from '../ui/Page'
import { Field, Segmented, SelectField, Swatches, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

const num = (v: number | undefined) => (v == null ? '' : String(v).replace('.', ','))

export default function LoanForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.loans[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const complet = useStore((s) => s.settings.mode === 'complet')
  const remove = useStore((s) => s.remove)
  const ensureCategory = useStore((s) => s.ensureLoanCategory)
  const currentMember = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()

  const [name, setName] = useState(existing?.name ?? '')
  const [lender, setLender] = useState(existing?.lender ?? '')
  const [principal, setPrincipal] = useState(num(existing?.principal))
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'XPF')
  const [rate, setRate] = useState(num(existing?.annualRate))
  const [years, setYears] = useState(existing ? String(Math.floor(existing.termMonths / 12)) : '')
  const [months, setMonths] = useState(existing ? String(existing.termMonths % 12) : '0')
  const [startDate, setStartDate] = useState(existing?.startDate ?? today())
  const [insurance, setInsurance] = useState(num(existing?.insuranceMonthly ?? 0))
  const [extras, setExtras] = useState<{ date: string; amount: string }[]>(existing?.extraRepayments.map((e) => ({ date: e.date, amount: num(e.amount) })) ?? [])
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'c-credits')
  const [member, setMember] = useState(existing?.member ?? currentMember ?? COMMON)
  const [color, setColor] = useState(existing?.color ?? '#7C2D12')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const P = parseAmount(principal)
  const R = rate.trim() === '' ? NaN : parseAmount(rate)
  const term = (Number(years) || 0) * 12 + (Number(months) || 0)
  const ins = parseAmount(insurance || '0')
  const valid = P > 0 && R >= 0 && term > 0
  const draft: Loan | null = valid ? {
    ...(existing ?? { id: 'draft', updatedAt: '' }),
    name: name.trim(), lender: lender.trim() || undefined, principal: P, currency, annualRate: R, termMonths: term, startDate,
    insuranceMonthly: Number.isNaN(ins) ? 0 : ins,
    extraRepayments: extras.map((e) => ({ date: e.date, amount: parseAmount(e.amount) })).filter((e) => e.date && e.amount > 0),
    accountId: accountId || undefined, categoryId, member, color, notes: notes.trim() || undefined,
  } : null
  const st = draft ? loanStatus(draft, today()) : null

  const save = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Donnez un nom au prêt (ex. Crédit maison).'
    if (!(P > 0)) e.principal = 'Indiquez le capital emprunté.'
    if (!(R >= 0)) e.rate = 'Indiquez le taux (0 si prêt à taux zéro).'
    if (!(term > 0)) e.term = 'Indiquez la durée.'
    setErrors(e)
    if (Object.keys(e).length || !draft) return
    if (categoryId === 'c-credits') ensureCategory()
    const { id: _, ...rest } = draft
    void _
    // Nouveau prêt déjà commencé : les échéances passées sont supposées réglées
    // (seules les suivantes seront proposées à l'enregistrement dans les opérations).
    const lastPaidDate = existing ? existing.lastPaidDate : schedule(draft).filter((r) => r.date < today()).at(-1)?.date
    const saved = upsert('loans', { ...rest, id: existing?.id, lastPaidDate })
    toast(existing ? 'Prêt modifié' : 'Prêt ajouté')
    nav(`/prets/${saved.id}`, { replace: true })
  }

  const del = () => {
    if (!existing) return
    remove('loans', existing.id)
    toast('Prêt supprimé', { label: 'Annuler', run: () => upsert('loans', { ...existing, deleted: false }) })
    nav('/prets')
  }

  return (
    <Page title={existing ? 'Modifier le crédit' : 'Nouveau crédit'} back
      actions={existing && <button className="icon-btn" aria-label="Supprimer" onClick={del}><Trash2 size={20} /></button>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <TextField label="Nom" value={name} onChange={setName} placeholder="Crédit maison, Voiture…" error={errors.name} autoFocus={!existing} />
        <TextField label="Banque" value={lender} onChange={setLender} placeholder="Banque de Tahiti, Socredo…" list="lenders" />
        <datalist id="lenders">{['Banque de Tahiti', 'Banque Socredo', 'Banque de Polynésie'].map((l) => <option key={l} value={l} />)}</datalist>
        <Field label="Montant emprunté" error={errors.principal}>
          <div className="input-group">
            <input className="input big" inputMode="decimal" placeholder="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} aria-label="Montant emprunté" />
            <select className="input" aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </Field>
        <div className="grid-2">
          <TextField label="Taux annuel (%)" inputMode="decimal" value={rate} onChange={setRate} placeholder="3,2" error={errors.rate} hint="Taux nominal, hors assurance." />
          <TextField label="Assurance / mois" inputMode="decimal" value={insurance} onChange={setInsurance} hint="0 si aucune." />
        </div>
        <Field label="Durée" error={errors.term}>
          <div className="input-group">
            <input className="input" type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} aria-label="Années" placeholder="20" />
            <span className="muted" style={{ alignSelf: 'center' }}>ans</span>
            <input className="input" type="number" min={0} max={11} value={months} onChange={(e) => setMonths(e.target.value)} aria-label="Mois" style={{ maxWidth: 80 }} />
            <span className="muted" style={{ alignSelf: 'center' }}>mois</span>
          </div>
        </Field>
        <TextField label="Date du premier remboursement" type="date" value={startDate} onChange={setStartDate} hint="Les échéances suivantes tombent le même jour chaque mois. Si le prêt a déjà commencé, les échéances passées sont considérées comme réglées." />

        {draft && st && (
          <div className="card stack" style={{ gap: 6 }}>
            <div className="split"><span className="muted">Mensualité</span><strong className="num">{formatMoney(monthlyPayment(P, R, term, currency) + draft.insuranceMonthly, currency)}</strong></div>
            <div className="split"><span className="muted">Coût des intérêts</span><span className="num">{formatMoney(st.totalInterest, currency)}</span></div>
            <div className="split"><span className="muted">Reste à rembourser aujourd'hui</span><span className="num">{formatMoney(st.remaining, currency)}</span></div>
            <div className="split"><span className="muted">Durée réelle</span><span className="num">{durationLabel(st.totalCount)}</span></div>
          </div>
        )}

        <details className="more-options" open={complet}>
          <summary>Plus d'options (remboursement anticipé, compte, notes…)</summary>
          <div className="form">
        <div className="field">
          <span className="label">Remboursements anticipés</span>
          {extras.map((e, i) => (
            <div key={i} className="input-group">
              <input className="input" type="date" value={e.date} aria-label="Date" onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, date: ev.target.value } : x)))} />
              <input className="input" inputMode="decimal" placeholder="Montant" value={e.amount} aria-label="Montant" style={{ maxWidth: 140 }} onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))} />
              <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><X size={18} /></button>
            </div>
          ))}
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExtras([...extras, { date: today(), amount: '' }])}><Plus size={16} />Ajouter</button>
          <span className="hint">La mensualité reste la même : le prêt se termine plus tôt.</span>
        </div>

        <SelectField label="Prélevé sur" value={accountId} onChange={setAccountId} options={[{ value: '', label: 'Non précisé' }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))]} />
        <SelectField label="Catégorie des mensualités" value={categoryId} onChange={setCategoryId}
          options={[...(categories.some((c) => c.id === 'c-credits') ? [] : [{ value: 'c-credits', label: 'Crédits & prêts' }]), ...categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }))]} />
        <div className="field">
          <span className="label">Emprunteur</span>
          <Segmented label="Membre" value={member} onChange={setMember} options={[...members.map((m) => ({ value: m.id, label: m.name })), { value: COMMON, label: 'Commun' }]} />
        </div>
        <div className="field"><span className="label">Couleur</span><Swatches value={color} onChange={setColor} colors={['#7C2D12', ...PALETTE]} /></div>
        <Field label="Notes"><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N° de dossier, conditions, garantie…" /></Field>
          </div>
        </details>
        <div className="sticky-actions"><button className="btn primary" type="submit">Enregistrer</button></div>
      </form>
    </Page>
  )
}
