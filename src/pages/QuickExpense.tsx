import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Delete, HelpCircle, X } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { COMMON, useAccounts, useCategories, useMembers } from '../data/hooks'
import { addInterval, today } from '../lib/dates'
import { normalize } from '../lib/id'
import { formatMoney, fromXPF, parseAmount, toXPF, type Currency } from '../lib/money'
import { parsePaymentText } from '../lib/quick'
import { cleanLabel, matchRule } from '../lib/rules'
import { CatIcon } from '../ui/Icon'
import { useToast } from '../ui/toast'

/**
 * Saisie express d'une dépense. Accepte des paramètres d'URL (automatisation Wallet) :
 * #/rapide?montant=2890&marchand=LE%20FOURNIL&devise=XPF&carte=5778  ou  #/rapide?titre=…&texte=…
 */
export default function QuickExpense() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const rates = useStore((s) => s.settings.rates)
  const me = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const accountsMap = useMap('accounts')
  const categories = useCategories().filter((c) => c.kind === 'expense')
  const members = useMembers()
  const rules = useList('rules')
  const txs = useList('transactions')

  // Pré-remplissage depuis une notification de paiement
  const fromUrl = useMemo(() => {
    const parsed = params.get('texte') || params.get('titre') ? parsePaymentText(params.get('titre') ?? '', params.get('texte') ?? '') : {}
    const amount = params.get('montant') ? parseAmount(params.get('montant')!) : parsed.amount
    return {
      amount: amount && !Number.isNaN(amount) ? amount : undefined,
      currency: ((params.get('devise') as Currency) || parsed.currency) ?? undefined,
      merchant: params.get('marchand') ?? parsed.merchant,
      last4: params.get('carte') ?? parsed.last4,
    }
  }, [params])

  const cardAccount = fromUrl.last4 ? accounts.find((a) => a.cardLast4?.includes(fromUrl.last4!)) : undefined
  const cardOwner = fromUrl.last4 && cardAccount ? cardAccount.cardOwners?.[fromUrl.last4] : undefined

  // Commerçants fréquents (90 derniers jours) avec leur catégorie et compte habituels
  const frequent = useMemo(() => {
    const since = addInterval(today(), -90, 'day')
    const m = new Map<string, { payee: string; n: number; categoryId?: string; accountId: string; last: string }>()
    for (const t of txs) {
      if (t.type !== 'expense' || !t.payee || t.date < since || t.subscriptionId || t.loanId) continue
      const k = normalize(t.payee)
      const e = m.get(k) ?? { payee: t.payee, n: 0, categoryId: t.categoryId, accountId: t.accountId, last: t.date }
      e.n++
      if (t.date >= e.last) Object.assign(e, { last: t.date, categoryId: t.categoryId ?? e.categoryId, accountId: t.accountId })
      m.set(k, e)
    }
    return [...m.values()].filter((e) => e.n >= 2).sort((a, b) => b.n - a.n).slice(0, 10)
  }, [txs])
  const topCats = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of txs) if (t.type === 'expense' && t.categoryId) count.set(t.categoryId, (count.get(t.categoryId) ?? 0) + 1)
    return [...categories].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
  }, [txs, categories])

  const lastAccount = txs.filter((t) => t.type === 'expense' && t.createdBy === me && !t.importHash).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.accountId
  const [digits, setDigits] = useState(fromUrl.amount ? String(fromUrl.amount).replace('.', ',') : '')
  const [currency, setCurrency] = useState<Currency>(fromUrl.currency ?? 'XPF')
  const [payee, setPayee] = useState(fromUrl.merchant ? cleanLabel(fromUrl.merchant) : '')
  const guess = (name: string) => {
    const known = frequent.find((f) => normalize(f.payee) === normalize(name))
    return known?.categoryId ?? matchRule(name, rules)?.categoryId
  }
  const [categoryId, setCategoryId] = useState<string | undefined>(() => (fromUrl.merchant ? guess(fromUrl.merchant) : undefined))
  const [accountId, setAccountId] = useState(cardAccount?.id ?? lastAccount ?? accounts[0]?.id ?? '')
  const [member, setMember] = useState(cardOwner ?? me ?? COMMON)
  const [date, setDate] = useState(today())
  const [showAll, setShowAll] = useState(false)

  const value = parseAmount(digits || '0')
  const account = accountsMap.get(accountId)
  const press = (k: string) => {
    if (k === '⌫') return setDigits((d) => d.slice(0, -1))
    if (k === ',' && (currency === 'XPF' || digits.includes(','))) return
    if (digits.replace(/\D/g, '').length >= 9) return
    setDigits((d) => (d === '0' && k !== ',' ? k : d + k))
  }
  const pickFrequent = (f: (typeof frequent)[number]) => {
    setPayee(f.payee)
    if (f.categoryId) setCategoryId(f.categoryId)
    setAccountId(f.accountId)
  }

  const save = () => {
    if (!(value > 0) || !account) return
    const foreign = currency !== account.currency
    const amount = foreign ? fromXPF(toXPF(value, currency, rates), account.currency, rates) : value
    const tx = upsert('transactions', {
      date, type: 'expense', amount, accountId, categoryId: categoryId ?? (payee ? guess(payee) : undefined), payee: payee.trim() || undefined,
      tags: [], member, ...(foreign ? { originalAmount: value, originalCurrency: currency } : {}),
    })
    toast(`${formatMoney(value, currency)} enregistré`, { label: 'Annuler', run: () => remove('transactions', tx.id) })
    nav('/', { replace: true })
  }

  const cats = showAll ? topCats : topCats.slice(0, 7)
  return (
    <main className="page quick">
      <header className="page-header">
        <button className="icon-btn" aria-label="Fermer" onClick={() => nav(-1)}><X size={22} /></button>
        <h1>Dépense rapide</h1>
        <Link to="/parametres/wallet" className="icon-btn" aria-label="Paiements Wallet automatiques"><HelpCircle size={20} /></Link>
      </header>

      <div className="quick-amount" aria-live="polite">
        <span className="num">{digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '0'}</span>
        <div className="seg" role="group" aria-label="Devise">
          {(['XPF', 'EUR', 'USD'] as Currency[]).map((c) => (
            <button key={c} type="button" aria-pressed={currency === c} onClick={() => { setCurrency(c); if (c === 'XPF') setDigits((d) => d.split(',')[0]) }}>{c === 'XPF' ? 'F' : c === 'EUR' ? '€' : '$'}</button>
          ))}
        </div>
      </div>
      {fromUrl.amount && <p className="faint" style={{ margin: 0 }}>Pré-rempli depuis la notification de paiement{cardAccount ? ` · carte ${fromUrl.last4} → ${cardAccount.name}` : ''}</p>}

      <input className="input" value={payee} onChange={(e) => { setPayee(e.target.value); const g = guess(e.target.value); if (g) setCategoryId(g) }} placeholder="Où ? (commerçant, facultatif)" aria-label="Commerçant" />
      {frequent.length > 0 && !payee && (
        <div className="chips" aria-label="Commerçants habituels">
          {frequent.map((f) => <button key={f.payee} type="button" className="chip" onClick={() => pickFrequent(f)}>{f.payee}</button>)}
        </div>
      )}

      <div className="quick-cats" role="group" aria-label="Catégorie">
        {cats.map((c) => (
          <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
            <CatIcon icon={c.icon} color={c.color} small /><span>{c.name}</span>
          </button>
        ))}
        {!showAll && <button type="button" onClick={() => setShowAll(true)}><span className="cat-icon sm" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>…</span><span>Autres</span></button>}
      </div>

      <div className="chips" role="group" aria-label="Payé avec">
        {accounts.filter((a) => a.type !== 'savings').map((a) => (
          <button key={a.id} type="button" className="chip" aria-pressed={accountId === a.id} onClick={() => setAccountId(a.id)}>{a.name.replace(/\s*\(.*\)/, '')}</button>
        ))}
      </div>
      <div className="split">
        <div className="chips" role="group" aria-label="Pour qui">
          {[...members.map((m) => ({ id: m.id, name: m.name })), { id: COMMON, name: 'Commun' }].map((m) => (
            <button key={m.id} type="button" className="chip" aria-pressed={member === m.id} onClick={() => setMember(m.id)}>{m.name}</button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Date">
          <button type="button" className="chip" aria-pressed={date === today()} onClick={() => setDate(today())}>Auj.</button>
          <button type="button" className="chip" aria-pressed={date === addInterval(today(), -1, 'day')} onClick={() => setDate(addInterval(today(), -1, 'day'))}>Hier</button>
        </div>
      </div>

      <div className="keypad" role="group" aria-label="Pavé numérique">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', currency === 'XPF' ? '000' : ',', '0', '⌫'].map((k) => (
          <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Effacer' : k}>{k === '⌫' ? <Delete size={22} /> : k}</button>
        ))}
      </div>
      <button className="btn primary block quick-save" disabled={!(value > 0) || !account} onClick={save}>
        Enregistrer {value > 0 ? formatMoney(value, currency) : ''}
      </button>
    </main>
  )
}
