import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { COMMON, useAccounts, useAllTags, useCategories, useMembers } from '../data/hooks'
import { PALETTE } from '../data/defaults'
import type { Subscription, SubscriptionStatus } from '../data/types'
import { formatDate, today, type IntervalUnit } from '../lib/dates'
import { CURRENCIES, effectiveFee, formatMoney, isFixedRate, parseAmount, type Currency } from '../lib/money'
import { cycleLabel, dueForPayment, isExact, monthlyCost, nextPayment, paymentXPF, upcomingPayments, yearlyCost } from '../lib/subscriptions'
import { Page, Section } from '../ui/Page'
import { Field, Segmented, SelectField, Swatches, TextField } from '../ui/Field'
import { TagInput } from '../ui/TagInput'
import { Money } from '../ui/Money'
import { useToast } from '../ui/toast'

const PRESETS: { label: string; every: number; unit: IntervalUnit }[] = [
  { label: 'Mensuel', every: 1, unit: 'month' },
  { label: 'Annuel', every: 1, unit: 'year' },
  { label: 'Trimestriel', every: 3, unit: 'month' },
  { label: 'Hebdo', every: 1, unit: 'week' },
]

export default function SubscriptionForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.subscriptions[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const complet = useStore((s) => s.settings.mode === 'complet')
  const remove = useStore((s) => s.remove)
  const markPaid = useStore((s) => s.markSubscriptionPaid)
  const rates = useStore((s) => s.settings.rates)
  const currentMember = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()
  const tags = useAllTags()

  const [name, setName] = useState(existing?.name ?? '')
  const [plan, setPlan] = useState(existing?.plan ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '')
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'XPF')
  const [every, setEvery] = useState(existing?.every ?? 1)
  const [unit, setUnit] = useState<IntervalUnit>(existing?.unit ?? 'month')
  const [startDate, setStartDate] = useState(existing?.startDate ?? today())
  const [hasTrial, setHasTrial] = useState(!!existing?.trialEnd)
  const [trialEnd, setTrialEnd] = useState(existing?.trialEnd ?? '')
  const [status, setStatus] = useState<SubscriptionStatus>(existing?.status ?? 'active')
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'c-abonnements')
  const [subTags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [color, setColor] = useState(existing?.color ?? PALETTE[0])
  const [member, setMember] = useState(existing?.member ?? currentMember ?? COMMON)
  const [remindDays, setRemind] = useState(String(existing?.remindDays ?? 2))
  const [url, setUrl] = useState(existing?.url ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const value = parseAmount(amount)
  const payAccount = accounts.find((a) => a.id === accountId)
  const fee = effectiveFee(currency, payAccount?.currency, payAccount?.fxFeePct)
  const draft: Subscription = {
    ...(existing ?? { id: 'draft', updatedAt: '' }),
    name: name.trim(), plan: plan.trim() || undefined, amount: Number.isNaN(value) ? 0 : value, currency, every, unit, startDate,
    trialEnd: hasTrial && trialEnd ? trialEnd : undefined, status: hasTrial && status === 'active' && trialEnd > today() ? 'trial' : status,
    accountId: accountId || undefined, categoryId, tags: subTags, color, member, remindDays: Math.max(0, Number(remindDays) || 0),
    url: url.trim() || undefined, notes: notes.trim() || undefined,
  }
  const preview = useMemo(() => upcomingPayments([draft], today(), '2099-12-31').slice(0, 3), [JSON.stringify(draft)]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const e: Record<string, string> = {}
    if (!draft.name) e.name = 'Donnez un nom à l’abonnement.'
    if (Number.isNaN(value) || value <= 0) e.amount = 'Indiquez un montant supérieur à 0.'
    if (every < 1) e.every = 'La fréquence doit être d’au moins 1.'
    if (hasTrial && !trialEnd) e.trial = 'Indiquez la fin de l’essai.'
    setErrors(e)
    if (Object.keys(e).length) return
    const { id: _, ...rest } = draft
    void _
    upsert('subscriptions', { ...rest, id: existing?.id, cancelledOn: draft.status === 'cancelled' ? existing?.cancelledOn ?? today() : undefined })
    toast(existing ? 'Abonnement modifié' : 'Abonnement ajouté')
    nav(-1)
  }

  const del = () => {
    if (!existing) return
    remove('subscriptions', existing.id)
    toast('Abonnement supprimé', { label: 'Annuler', run: () => upsert('subscriptions', { ...existing, deleted: false }) })
    nav('/abonnements')
  }

  const next = existing ? nextPayment(existing, today()) : null
  const due = existing ? dueForPayment(existing, today()) : []
  const exact = isExact(draft, fee)

  return (
    <Page title={existing ? existing.name : 'Nouvel abonnement'} back
      actions={existing && <button className="icon-btn" aria-label="Supprimer" onClick={del}><Trash2 size={20} /></button>}>
      {existing && (
        <div className="card stack">
          <div className="split">
            <span className="muted">Prochain prélèvement</span>
            <strong>{next ? formatDate(next) : '—'}</strong>
          </div>
          {due.length > 0 && (
            <div className="callout warn" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{due.length} échéance{due.length > 1 ? 's' : ''} passée{due.length > 1 ? 's' : ''} non enregistrée{due.length > 1 ? 's' : ''} ({due.map(formatDate).join(', ')})</span>
              <button className="btn sm" onClick={() => { due.forEach((d) => markPaid(useStore.getState().data.subscriptions[existing.id], d)); toast(`${due.length} opération(s) créée(s)`) }}>
                <Check size={16} />Payé
              </button>
            </div>
          )}
          {existing.lastPaidDate && <span className="faint">Dernier paiement enregistré : {formatDate(existing.lastPaidDate)}</span>}
        </div>
      )}

      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <TextField label="Nom" value={name} onChange={setName} placeholder="Netflix, Vini, Viti Ora…" error={errors.name} autoFocus={!existing} />
        <TextField label="Formule" value={plan} onChange={setPlan} placeholder="Facultatif (ex. Premium, 2 To)" />
        <Field label="Prix" error={errors.amount}
          hint={!Number.isNaN(value) && value > 0 && currency !== 'XPF' ? (
            <>{isFixedRate(currency) ? '= ' : '≈ '}{formatMoney(paymentXPF(draft, rates, 0))}{currency === 'EUR' ? ' (parité fixe)' : ' (taux du jour)'}{fee ? ` · avec ${String(fee).replace('.', ',')} % de frais : ${formatMoney(paymentXPF(draft, rates, fee))}` : ''}</>
          ) : undefined}>
          <div className="input-group">
            <input className="input big" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Montant" />
            <select className="input" aria-label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code === 'XPF' ? 'F' : c.code}</option>)}
            </select>
          </div>
        </Field>

        <div className="field">
          <span className="label">Fréquence · {cycleLabel({ every, unit })}</span>
          <div className="chips">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" aria-pressed={p.every === every && p.unit === unit} onClick={() => { setEvery(p.every); setUnit(p.unit) }}>{p.label}</button>
            ))}
          </div>
          <div className="input-group">
            <input className="input" type="number" min={1} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} aria-label="Tous les" style={{ maxWidth: 90 }} />
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as IntervalUnit)} aria-label="Unité" style={{ flex: 1, width: '100%' }}>
              <option value="day">jour(s)</option><option value="week">semaine(s)</option><option value="month">mois</option><option value="year">an(s)</option>
            </select>
          </div>
          {errors.every && <span className="error">{errors.every}</span>}
        </div>

        <TextField label="Prochain paiement le" type="date" value={startDate} onChange={setStartDate}
          hint="Les paiements suivants sont calculés tout seuls." />


        {preview.length > 0 && (
          <div className="card stack" style={{ gap: 6 }}>
            <div className="split"><span className="muted">Coût mensuel</span><Money value={monthlyCost(draft, rates, fee)} approx={!exact} /></div>
            <div className="split"><span className="muted">Coût annuel</span><Money value={yearlyCost(draft, rates, fee)} approx={!exact} /></div>
            <div className="split" style={{ alignItems: 'flex-start' }}><span className="muted">Prochains</span><span className="num next-dates">{preview.map((p) => <span key={p.date}>{formatDate(p.date)}</span>)}</span></div>
          </div>
        )}

        <SelectField label="Prélevé sur" value={accountId} onChange={setAccountId}
          options={[{ value: '', label: 'Non précisé' }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))]}
          hint={currency !== 'XPF' && fee === 0 ? 'Astuce : indiquez les frais de change de la carte dans Comptes pour voir le coût réel.' : undefined} />
        <details className="more-options" open={complet}>
          <summary>Plus d'options</summary>
          <div className="form">
        <label className="check">
          <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />
          <span>Période d'essai gratuite</span>
        </label>
        {hasTrial && <TextField label="Fin de l'essai (premier paiement)" type="date" value={trialEnd} onChange={setTrialEnd} error={errors.trial} hint="Pensez à résilier avant cette date si vous ne voulez pas continuer." />}
        <SelectField label="Catégorie" value={categoryId} onChange={setCategoryId}
          options={categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }))} />
        <TagInput label="Étiquettes" value={subTags} onChange={setTags} suggestions={[...new Set([...tags, 'Streaming', 'Stockage', 'Utilitaire', 'Télécom', 'Jeux', 'Musique', 'VOD'])]} />
        <SelectField label="État" value={status} onChange={setStatus} options={[
          { value: 'active', label: 'Actif' }, { value: 'trial', label: 'Essai' }, { value: 'paused', label: 'En pause' }, { value: 'cancelled', label: 'Résilié' },
        ]} />
        <div className="field">
          <span className="label">Pour qui</span>
          <Segmented label="Membre" value={member} onChange={setMember} options={[...members.map((m) => ({ value: m.id, label: m.name })), { value: COMMON, label: 'Commun' }]} />
        </div>
        <TextField label="Rappel (jours avant)" type="number" min={0} value={remindDays} onChange={setRemind} hint="Signalé « Bientôt » sur l'accueil." />
        <div className="field"><span className="label">Couleur</span><Swatches value={color} onChange={setColor} colors={[...PALETTE, '#E50914', '#1DB954', '#03A9F4', '#A68D85']} /></div>
        <TextField label="Lien de gestion / résiliation" type="url" value={url} onChange={setUrl} placeholder="https://" />
        <Field label="Notes"><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {url && existing && <a href={url} target="_blank" rel="noreferrer" className="btn">Ouvrir le site</a>}
          </div>
        </details>

        <div className="sticky-actions"><button className="btn primary" type="submit">Enregistrer</button></div>
      </form>
      {existing && (
        <Section title="Actions">
          <div className="btn-row">
            <button className="btn" onClick={() => { markPaid(existing, today()); toast("Paiement d'aujourd'hui enregistré") }}><Check size={16} />Payé aujourd'hui</button>
            {existing.status !== 'cancelled' && (
              <button className="btn danger" onClick={() => { upsert('subscriptions', { ...existing, status: 'cancelled', cancelledOn: today() }); toast(`${existing.name} résilié`, { label: 'Annuler', run: () => upsert('subscriptions', existing) }); nav('/abonnements') }}>
                Marquer résilié
              </button>
            )}
          </div>
          <p className="faint" style={{ margin: 0 }}>{exact ? 'Montant exact en F.' : 'Montant en F estimé (« ≈ ») : taux variable ou frais de change.'} Prochain : {formatMoney(paymentXPF(draft, rates, fee))}.</p>
        </Section>
      )}
    </Page>
  )
}
