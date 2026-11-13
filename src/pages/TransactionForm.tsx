import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useList, useStore } from '../data/store'
import { COMMON, useAccounts, useAllTags, useCategories, useMembers } from '../data/hooks'
import type { Transaction, TxType } from '../data/types'
import { today } from '../lib/dates'
import { entryWarnings } from '../lib/checks'
import { isValidAmount } from '../lib/quick'
import { CURRENCIES, effectiveFee, formatMoney, fromXPF, parseAmount, roundTo, toXPF, type Currency } from '../lib/money'
import { cleanLabel, matchRule } from '../lib/rules'
import { Page } from '../ui/Page'
import { Field, Segmented, SelectField, TextField } from '../ui/Field'
import { CategoryPicker } from '../ui/CategoryPicker'
import { TagInput } from '../ui/TagInput'
import { Attachments } from '../ui/Attachments'
import type { AttachmentMeta } from '../data/types'
import { useToast } from '../ui/toast'

const fmtInput = (n: number | undefined, cur: Currency) => (n == null || Number.isNaN(n) ? '' : String(roundTo(n, cur)).replace('.', ','))

/** Recette R4 : un nouveau `?type=` recrée le formulaire (sinon il gardait l'ancien type). */
export default function TransactionFormRoute() {
  const [params] = useSearchParams()
  const { id } = useParams()
  return <TransactionForm key={`${id ?? 'nouvelle'}:${params.get('type') ?? ''}`} />
}

function TransactionForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.transactions[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const complet = useStore((s) => s.settings.mode === 'complet')
  const remove = useStore((s) => s.remove)
  const rates = useStore((s) => s.settings.rates)
  const currentMember = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()
  const rules = useList('rules')
  const allTx = useList('transactions')
  const tags = useAllTags()
  const trips = useList('trips')

  const [type, setType] = useState<TxType>(existing?.type ?? ((params.get('type') as TxType) || 'expense'))
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '')
  const account = accounts.find((a) => a.id === accountId)
  const [currency, setCurrency] = useState<Currency>(existing?.originalCurrency ?? account?.currency ?? 'XPF')
  const [amount, setAmount] = useState(existing ? fmtInput(existing.originalAmount ?? existing.amount, existing.originalCurrency ?? account?.currency ?? 'XPF') : '')
  const [debited, setDebited] = useState(existing?.originalCurrency ? fmtInput(existing.amount, account?.currency ?? 'XPF') : '')
  const [debitedTouched, setDebitedTouched] = useState(!!existing?.originalCurrency)
  const [date, setDate] = useState(existing?.date ?? today())
  const [categoryId, setCategoryId] = useState(existing?.categoryId)
  const [catTouched, setCatTouched] = useState(!!existing?.categoryId)
  const [payee, setPayee] = useState(existing?.payee ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [txTags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [member, setMember] = useState(existing?.member ?? currentMember ?? COMMON)
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? accounts.find((a) => a.id !== accountId)?.id ?? '')
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const [toAmount, setToAmount] = useState(existing?.toAmount != null ? fmtInput(existing.toAmount, toAccount?.currency ?? 'XPF') : '')
  const [tripId, setTripId] = useState(existing?.tripId ?? params.get('voyage') ?? '')
  const trip = trips.find((x) => x.id === tripId)
  const [error, setError] = useState<string>()
  const [attachments, setAttachments] = useState<AttachmentMeta[]>(existing?.attachments ?? [])

  const foreign = !!account && currency !== account.currency
  const fee = account ? effectiveFee(currency, account.currency, account.fxFeePct) : 0
  const value = parseAmount(amount)
  const suggestedDebit = foreign && !Number.isNaN(value)
    ? fromXPF(toXPF(value, currency, rates) * (1 + fee / 100), account!.currency, rates)
    : undefined
  useEffect(() => {
    if (foreign && !debitedTouched) setDebited(suggestedDebit != null ? fmtInput(suggestedDebit, account!.currency) : '')
  }, [foreign, debitedTouched, suggestedDebit, account])

  const transferForeign = type === 'transfer' && toAccount && account && toAccount.currency !== account.currency
  const suggestedTo = transferForeign && !Number.isNaN(value) ? fromXPF(toXPF(value, account!.currency, rates), toAccount!.currency, rates) : undefined

  // Auto-catégorisation depuis le bénéficiaire (règles + historique).
  const payees = useMemo(() => [...new Set(allTx.map((t) => t.payee).filter(Boolean) as string[])].sort(), [allTx])
  const onPayee = (v: string) => {
    setPayee(v)
    if (catTouched || !v) return
    const past = allTx.find((t) => t.payee?.toLowerCase() === v.toLowerCase() && t.categoryId)
    const cat = past?.categoryId ?? matchRule(v, rules)?.categoryId
    if (cat) setCategoryId(cat)
  }

  const save = () => {
    if (Number.isNaN(value) || value <= 0) return setError('Indiquez un montant supérieur à 0.')
    if (!isValidAmount(value)) return setError('Montant trop grand : 9 chiffres au plus avant la virgule.')
    if (!accountId) return setError('Choisissez un compte.')
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choisissez un compte de destination différent.')
    const debit = foreign ? parseAmount(debited) : value
    if (Number.isNaN(debit) || debit <= 0) return setError('Indiquez le montant débité sur le compte.')
    // Recette R6 : confirmation si le montant est inhabituel ou la date dans le futur (seulement si on les a saisis ou changés).
    if (!existing || (existing.originalAmount ?? existing.amount) !== value || existing.date !== date) {
      const warn = entryWarnings({ amount: value, currency, date, today: today(), rates })
      if (warn.length && !confirm(`${warn.join('\n')}\nEnregistrer quand même ?`)) return
    }
    const rec: Partial<Transaction> = {
      ...existing,
      id: existing?.id,
      type,
      date,
      accountId,
      amount: roundTo(Math.abs(debit), account!.currency),
      originalAmount: foreign ? value : undefined,
      originalCurrency: foreign ? currency : undefined,
      categoryId: type === 'transfer' || categories.find((c) => c.id === categoryId)?.kind !== type ? undefined : categoryId,
      payee: type === 'transfer' ? undefined : payee.trim() || undefined,
      note: note.trim() || undefined,
      tags: txTags,
      member,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      toAmount: type === 'transfer' ? (transferForeign ? parseAmount(toAmount) || suggestedTo : undefined) : undefined,
      tripId: type === 'expense' && tripId ? tripId : undefined,
      attachments: attachments.length ? attachments : undefined,
    }
    upsert('transactions', rec)
    toast(existing ? 'Opération modifiée' : 'Opération ajoutée')
    nav(-1)
  }

  const del = () => {
    if (!existing) return
    remove('transactions', existing.id)
    toast('Opération supprimée', { label: 'Annuler', run: () => upsert('transactions', { ...existing, deleted: false }) })
    nav(-1)
  }

  return (
    <Page title={existing ? 'Modifier' : type === 'expense' ? 'Nouvelle dépense' : type === 'income' ? 'Nouveau revenu' : 'Entre nos comptes'} back
      actions={existing && <button className="icon-btn" aria-label="Supprimer" onClick={del}><Trash2 size={20} /></button>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Segmented label="Type" value={type} onChange={setType} options={[{ value: 'expense', label: 'Dépense' }, { value: 'income', label: 'Revenu' }, { value: 'transfer', label: 'Entre nos comptes' }]} />

        <Field label="Montant" error={error}>
          <div className="input-group">
            <input className="input big" inputMode="decimal" autoFocus={!existing} placeholder="0" value={amount} aria-label="Montant"
              onChange={(e) => { setAmount(e.target.value); setError(undefined) }} />
            <select className="input" aria-label="Devise" value={currency} onChange={(e) => { setCurrency(e.target.value as Currency); setDebitedTouched(false) }}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code === 'XPF' ? 'F' : c.code}</option>)}
            </select>
          </div>
        </Field>

        <div className="grid-2">
          <SelectField label={type === 'transfer' ? 'Depuis' : 'Compte'} value={accountId} onChange={(v) => { setAccountId(v); setDebitedTouched(false) }}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} />
          <TextField label="Date" type="date" value={date} onChange={setDate} required />
        </div>

        {foreign && (
          <TextField label={`Montant débité sur le compte (${account!.currency})`} inputMode="decimal" value={debited}
            onChange={(v) => { setDebited(v); setDebitedTouched(true) }}
            hint={currency === 'EUR' && account!.currency === 'XPF'
              ? `Parité fixe : ${formatMoney(value || 0, 'EUR')} = ${formatMoney(toXPF(value || 0, 'EUR', rates))}${fee ? ` + ${String(fee).replace('.', ',')} % de frais` : ''}. Corrigez avec le montant réel du relevé.`
              : `Estimation au taux du jour${fee ? ` + ${String(fee).replace('.', ',')} % de frais` : ''}. Corrigez avec le montant réel du relevé.`} />
        )}

        {type === 'transfer' ? (
          <>
            <SelectField label="Vers" value={toAccountId} onChange={setToAccountId}
              options={accounts.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} />
            {transferForeign && (
              <TextField label={`Montant reçu (${toAccount!.currency})`} inputMode="decimal" value={toAmount} onChange={setToAmount}
                placeholder={suggestedTo != null ? fmtInput(suggestedTo, toAccount!.currency) : ''} hint="Laissez vide pour utiliser la conversion." />
            )}
          </>
        ) : (
          <>
            <TextField label={type === 'expense' ? 'Payé à' : 'Reçu de'} value={payee} onChange={onPayee} list="payees" placeholder="Ex. Carrefour Arue" autoComplete="off" />
            <datalist id="payees">{payees.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="field">
              <span className="label">Catégorie</span>
              <CategoryPicker categories={categories} kind={type} value={categoryId} onChange={(c) => { setCategoryId(c); setCatTouched(true) }} />
            </div>
          </>
        )}

        <details className="more-options" open={complet}>
          <summary>Plus d'options (pour qui, voyage, note, ticket…)</summary>
          <div className="form">
        {type === 'expense' && trips.length > 0 && (
          <div className="field">
            <label htmlFor="trip">Voyage</label>
            <select id="trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">Aucun</option>
              {[...trips].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {trip && trip.budgetLines.length > 0 && (
              <div className="chips" style={{ flexWrap: 'wrap' }} role="group" aria-label="Poste du budget">
                {trip.budgetLines.map((l) => (
                  <button key={l.id} type="button" className="chip" aria-pressed={txTags.includes(l.label)}
                    onClick={() => setTags(txTags.includes(l.label) ? txTags.filter((x) => x !== l.label) : [...txTags.filter((x) => !trip.budgetLines.some((b) => b.label === x)), l.label])}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="field">
          <span className="label">Pour qui</span>
          <Segmented label="Membre" value={member} onChange={setMember} options={[...members.map((m) => ({ value: m.id, label: m.name })), { value: COMMON, label: 'Commun' }]} />
        </div>
        <TagInput label="Étiquettes" value={txTags} onChange={setTags} suggestions={tags} />
        <TextField label="Note" value={note} onChange={setNote} placeholder="Facultatif" />
        <Attachments value={attachments} onChange={setAttachments} />
        {existing?.reconciledAt && <p className="faint" style={{ margin: 0 }}>✓ Retrouvée sur le relevé de la banque{existing.rawLabel ? ` (« ${existing.rawLabel} »)` : ''}.</p>}
        {existing?.rawLabel && <p className="faint" style={{ margin: 0 }}>Texte sur le relevé : {existing.rawLabel} {existing.rawLabel !== payee && <button type="button" className="btn sm" onClick={() => onPayee(cleanLabel(existing.rawLabel!))}>Utiliser</button>}</p>}
          </div>
        </details>

        <div className="sticky-actions">
          <button className="btn primary" type="submit">Enregistrer</button>
        </div>
      </form>
    </Page>
  )
}
