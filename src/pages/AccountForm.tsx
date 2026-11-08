import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, List, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { COMMON, useMembers } from '../data/hooks'
import { PALETTE } from '../data/defaults'
import type { AccountType, Institution } from '../data/types'
import { CURRENCIES, parseAmount, type Currency } from '../lib/money'
import { Page } from '../ui/Page'
import { SelectField, Swatches, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

export const INSTITUTIONS: { value: Institution; label: string; currency: Currency; type: AccountType }[] = [
  { value: 'banque-de-tahiti', label: 'Banque de Tahiti', currency: 'XPF', type: 'checking' },
  { value: 'socredo', label: 'Banque Socredo', currency: 'XPF', type: 'checking' },
  { value: 'banque-de-polynesie', label: 'Banque de Polynésie', currency: 'XPF', type: 'checking' },
  { value: 'amex', label: 'American Express', currency: 'XPF', type: 'credit' },
  { value: 'deblock', label: 'Deblock', currency: 'EUR', type: 'checking' },
  { value: 'cash', label: 'Espèces', currency: 'XPF', type: 'cash' },
  { value: 'other', label: 'Autre', currency: 'XPF', type: 'checking' },
]

export default function AccountForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useStore((s) => (id ? s.data.accounts[id] : undefined))
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const hasTx = useStore((s) => !!id && Object.values(s.data.transactions).some((t) => !t.deleted && (t.accountId === id || t.toAccountId === id)))
  const toast = useToast((s) => s.show)
  const members = useMembers()

  const [institution, setInstitution] = useState<Institution>(existing?.institution ?? 'banque-de-tahiti')
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<AccountType>(existing?.type ?? 'checking')
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'XPF')
  const [initial, setInitial] = useState(existing ? String(existing.initialBalance).replace('.', ',') : '0')
  const [initialDate, setInitialDate] = useState(existing?.initialDate ?? '')
  const [fee, setFee] = useState(String(existing?.fxFeePct ?? 0).replace('.', ','))
  const [color, setColor] = useState(existing?.color ?? PALETTE[0])
  const [owner, setOwner] = useState(existing?.owner ?? COMMON)
  const [error, setError] = useState<string>()

  const pickInstitution = (v: Institution) => {
    setInstitution(v)
    const i = INSTITUTIONS.find((x) => x.value === v)!
    if (!existing) {
      setCurrency(i.currency)
      setType(i.type)
      if (!name) setName(i.label)
    }
  }

  const save = () => {
    const bal = parseAmount(initial || '0')
    const f = parseAmount(fee || '0')
    if (!name.trim()) return setError('Donnez un nom au compte.')
    if (Number.isNaN(bal)) return setError('Solde initial illisible.')
    upsert('accounts', { ...(existing ?? {}), id: existing?.id, name: name.trim(), institution, type, currency, initialBalance: bal, initialDate: initialDate || undefined, fxFeePct: Number.isNaN(f) ? 0 : f, color, owner })
    toast(existing ? 'Compte modifié' : 'Compte ajouté')
    nav(-1)
  }

  return (
    <Page title={existing ? existing.name : 'Nouveau compte'} back actions={existing && (
      hasTx
        ? <button className="icon-btn" aria-label={existing.archived ? 'Désarchiver' : 'Archiver'} onClick={() => { upsert('accounts', { ...existing, archived: !existing.archived }); toast(existing.archived ? 'Compte désarchivé' : 'Compte archivé') }}><Archive size={20} /></button>
        : <button className="icon-btn" aria-label="Supprimer" onClick={() => { remove('accounts', existing.id); toast('Compte supprimé', { label: 'Annuler', run: () => upsert('accounts', { ...existing, deleted: false }) }); nav('/comptes') }}><Trash2 size={20} /></button>
    )}>
      {existing && <Link className="btn" to={`/operations?compte=${existing.id}`}><List size={18} />Voir les opérations</Link>}
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <SelectField label="Établissement" value={institution} onChange={pickInstitution} options={INSTITUTIONS.map((i) => ({ value: i.value, label: i.label }))} />
        <TextField label="Nom" value={name} onChange={setName} error={error} />
        <div className="grid-2">
          <SelectField label="Type" value={type} onChange={setType} options={[
            { value: 'checking', label: 'Compte courant' }, { value: 'savings', label: 'Épargne' }, { value: 'credit', label: 'Carte de crédit' }, { value: 'cash', label: 'Espèces' },
          ]} />
          <SelectField label="Devise" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))}
            hint={hasTx && existing?.currency !== currency ? 'Attention : les montants existants ne sont pas convertis.' : undefined} />
        </div>
        <div className="grid-2">
          <TextField label="Solde initial" inputMode="decimal" value={initial} onChange={setInitial} hint={type === 'credit' ? 'Négatif si vous devez de l’argent.' : undefined} />
          <TextField label="Au (facultatif)" type="date" value={initialDate} onChange={setInitialDate} hint="Si une date est indiquée, les opérations antérieures ne changent pas ce solde." />
        </div>
        <TextField label="Frais sur paiements en devises (%)" inputMode="decimal" value={fee} onChange={setFee}
          hint="Commission de la banque sur les achats en euros/dollars (voir vos conditions tarifaires). Sert à estimer le coût réel des abonnements étrangers." />
        <div className="field">
          <span className="label">Titulaire</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={COMMON}>Compte commun</option>
          </select>
        </div>
        <div className="field"><span className="label">Couleur</span><Swatches value={color} onChange={setColor} colors={PALETTE} /></div>
        <div className="sticky-actions"><button className="btn primary" type="submit">Enregistrer</button></div>
      </form>
    </Page>
  )
}
