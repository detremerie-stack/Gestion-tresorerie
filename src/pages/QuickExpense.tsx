import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, Camera, Delete, HelpCircle, Plane, Repeat, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { useList, useMap, useStore } from '../data/store'
import { COMMON, useAccounts, useCategories, useMembers } from '../data/hooks'
import { addInterval, today } from '../lib/dates'
import { normalize } from '../lib/id'
import { effectiveFee, formatMoney, fromXPF, isFixedRate, parseAmount, rateOf, toXPF, type Currency } from '../lib/money'
import { fetchRates } from '../lib/rates'
import { ocrImage, pendingTicket, saveAttachment } from '../lib/attachments'
import { parseReceipt } from '../lib/receipt'
import type { AttachmentMeta } from '../data/types'
import { AttachmentThumb } from '../ui/Attachments'
import { CategoryEditor } from '../ui/CategoryEditor'
import { isValidAmount, knownCurrency, quickParams } from '../lib/quick'
import { cleanLabel, matchRule } from '../lib/rules'
import { CatIcon } from '../ui/Icon'
import { useToast } from '../ui/toast'
import { quickKey } from '../ui/keys'

/** Choix « Autre chose ? » (Q5) : tout ce qui n'est pas une dépense rapide. */
const OTHER = [
  { to: '/operations/nouvelle?type=income', icon: <TrendingUp size={22} className="income" />, label: 'Revenu' },
  { to: '/operations/nouvelle?type=transfer', icon: <ArrowLeftRight size={22} />, label: 'Entre nos comptes' },
  { to: '/operations/nouvelle?type=expense', icon: <TrendingDown size={22} />, label: 'Dépense détaillée' },
  { to: '/abonnements/nouveau', icon: <Repeat size={22} />, label: 'Abonnement' },
  { to: '/voyages/nouveau', icon: <Plane size={22} />, label: 'Voyage' },
]

/**
 * Saisie express d'une dépense. Accepte des paramètres d'URL (automatisation Wallet) :
 * #/rapide?montant=2890&marchand=LE%20FOURNIL&devise=XPF&carte=1234  ou  #/rapide?titre=…&texte=…
 */
export default function QuickExpense() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const rates = useStore((s) => s.settings.rates)
  const ratesUpdatedAt = useStore((s) => s.settings.ratesUpdatedAt)
  const setSettings = useStore((s) => s.setSettings)
  const trips = useList('trips')
  const me = useStore((s) => s.settings.currentMember)
  const toast = useToast((s) => s.show)
  const accounts = useAccounts()
  const accountsMap = useMap('accounts')
  const categories = useCategories().filter((c) => c.kind === 'expense')
  const members = useMembers()
  const rules = useList('rules')
  const txs = useList('transactions')

  // Pré-remplissage depuis une notification de paiement
  // Paramètres validés : montant hors bornes ou devise inconnue ignorés (lien piégé, P3).
  const fromUrl = useMemo(() => quickParams((k) => params.get(k)), [params])

  const t0 = today()
  const trip = trips.find((x) => x.startDate <= t0 && t0 <= x.endDate)
  const [tripMode, setTripMode] = useState(!!trip)
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
  const [currency, setCurrency] = useState<Currency>(fromUrl.currency ?? (trip?.currency && tripMode ? trip.currency : 'XPF'))
  const [payee, setPayee] = useState(fromUrl.merchant ? cleanLabel(fromUrl.merchant) : '')
  const guess = (name: string) => {
    const known = frequent.find((f) => normalize(f.payee) === normalize(name))
    return known?.categoryId ?? matchRule(name, rules)?.categoryId
  }
  const [categoryId, setCategoryId] = useState<string | undefined>(() => (fromUrl.merchant ? guess(fromUrl.merchant) : undefined))
  const [accountId, setAccountId] = useState(cardAccount?.id ?? (trip && tripMode ? trip.cardAccountId : undefined) ?? lastAccount ?? accounts[0]?.id ?? '')
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [scan, setScan] = useState<string>()
  const camRef = useRef<HTMLInputElement>(null)

  // Taux du jour (BCE) : rafraîchi à l'ouverture s'il date de plus de 12 h.
  useEffect(() => {
    if (ratesUpdatedAt && Date.now() - Date.parse(ratesUpdatedAt) < 12 * 3600 * 1000) return
    fetchRates().then((r) => setSettings({ rates: { ...useStore.getState().settings.rates, ...r }, ratesUpdatedAt: new Date().toISOString() })).catch(() => {})
  }, [ratesUpdatedAt, setSettings])

  const onTicket = async (file?: File) => {
    if (!file) return
    setScan('Lecture du ticket… 0 %')
    try {
      const meta = await saveAttachment(file)
      setAttachments((a) => [...a, meta])
      const text = await ocrImage(file, (p) => setScan(`Lecture du ticket… ${Math.round(p * 100)} %`))
      const r = parseReceipt(text, currency)
      if (r.amount) { setDigits(String(r.amount).replace('.', ',')); if (r.currency) setCurrency(r.currency) }
      if (r.merchant) { setPayee(cleanLabel(r.merchant)); const g = guess(r.merchant); if (g) setCategoryId(g) }
      if (r.date && r.date <= today()) setDate(r.date)
      setScan(r.amount ? 'Ticket lu : vérifiez le montant.' : 'Montant non trouvé : saisissez-le, le ticket est joint.')
    } catch {
      setScan('Lecture impossible (connexion nécessaire la 1re fois). Le ticket est joint, saisissez le montant.')
    }
  }
  const [member, setMember] = useState(cardOwner ?? me ?? COMMON)
  const [date, setDate] = useState(today())
  const [showAll, setShowAll] = useState(false)
  const [creatingCat, setCreatingCat] = useState(false)
  const [other, setOther] = useState(false)

  const value = parseAmount(digits || '0')
  const account = accountsMap.get(accountId)
  const press = (k: string) => {
    if (k === '⌫') return setDigits((d) => d.slice(0, -1))
    if (k === ',' && (currency === 'XPF' || digits.includes(','))) return
    setDigits((d) => {
      const next = d === '0' && k !== ',' ? k : d + k
      // Au plus 9 chiffres avant la virgule, touche « 000 » comprise.
      return next.split(',')[0].replace(/\D/g, '').length > 9 ? d : next
    })
  }
  const pickFrequent = (f: (typeof frequent)[number]) => {
    setPayee(f.payee)
    if (f.categoryId) setCategoryId(f.categoryId)
    setAccountId(f.accountId)
  }

  useEffect(() => {
    const f = pendingTicket.file
    if (f) { pendingTicket.file = undefined; void onTicket(f) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    // Refus de tout montant non fini, nul, négatif ou de plus de 9 chiffres, et de toute devise inconnue.
    if (!isValidAmount(value) || !knownCurrency(currency) || !account) return
    const foreign = currency !== account.currency
    const fee = effectiveFee(currency, account.currency, account.fxFeePct)
    const amount = foreign ? fromXPF(toXPF(value, currency, rates) * (1 + fee / 100), account.currency, rates) : value
    if (!Number.isFinite(amount) || !(amount > 0)) return
    const tx = upsert('transactions', {
      date, type: 'expense', amount, accountId, categoryId: categoryId ?? (payee ? guess(payee) : undefined), payee: payee.trim() || undefined,
      tags: [], member, ...(foreign ? { originalAmount: value, originalCurrency: currency, rateUsed: rateOf(currency, rates) } : {}),
      ...(tripMode && trip ? { tripId: trip.id } : {}), ...(attachments.length ? { attachments } : {}),
    })
    toast(`${formatMoney(value, currency)} enregistré`, { label: 'Annuler', run: () => remove('transactions', tx.id) })
    nav('/', { replace: true })
  }

  // Fermer : retour à l'écran précédent, ou à l'accueil si l'on est arrivé directement ici (raccourci, MacroDroid).
  const close = () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/', { replace: true }))

  // Clavier (PC) : chiffres, virgule, Retour arrière, Entrée = enregistrer, Échap = fermer.
  const keyRef = useRef({ press, save, close })
  keyRef.current = { press, save, close }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      const k = quickKey(e)
      if (!k) return
      const t = e.target as HTMLElement | null
      // Entrée sur un lien ou un bouton d'en-tête (✕, ?) ou « Autre chose » : action normale du bouton.
      if (k === 'save' && t?.closest?.('a, .page-header, [data-native-enter]')) return
      e.preventDefault()
      if (k === 'close') keyRef.current.close()
      else if (k === 'save') keyRef.current.save()
      else keyRef.current.press(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cats = showAll ? topCats : topCats.slice(0, 7)
  return (
    <main className="page quick">
      <header className="page-header">
        <button className="icon-btn" aria-label="Fermer" onClick={close}><X size={22} /></button>
        <h1>Dépense rapide</h1>
        <Link to="/parametres/wallet" className="icon-btn" aria-label="Paiements Wallet automatiques"><HelpCircle size={20} /></Link>
      </header>

      {trip && (
        <button type="button" className={`chip ${tripMode ? '' : ''}`} aria-pressed={tripMode} onClick={() => setTripMode(!tripMode)} style={{ alignSelf: 'flex-start' }}>
          <Plane size={14} />Mode voyage · {trip.name}{tripMode ? ' ✓' : ''}
        </button>
      )}
      <div className="quick-amount" aria-live="polite">
        <span className="num">{digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '0'}</span>
        <div className="seg" role="group" aria-label="Devise">
          {(['XPF', 'EUR', 'USD'] as Currency[]).map((c) => (
            <button key={c} type="button" aria-pressed={currency === c} onClick={() => { setCurrency(c); if (c === 'XPF') setDigits((d) => d.split(',')[0]) }}>{c === 'XPF' ? 'F' : c === 'EUR' ? '€' : '$'}</button>
          ))}
        </div>
      </div>
      {fromUrl.amount && <p className="faint" style={{ margin: 0 }}>Pré-rempli depuis la notification de paiement{cardAccount ? ` · carte ${fromUrl.last4} → ${cardAccount.name}` : ''}</p>}

      {currency !== 'XPF' && value > 0 && account && (
        <p className="faint" style={{ margin: 0 }}>
          ≈ {formatMoney(toXPF(value, currency, rates) * (1 + effectiveFee(currency, account.currency, account.fxFeePct) / 100))}
          {isFixedRate(currency) ? ' (parité fixe)' : ` · 1 ${currency} = ${String(rateOf(currency, rates)).replace('.', ',')} F`}
          {effectiveFee(currency, account.currency, account.fxFeePct) ? ` + ${String(effectiveFee(currency, account.currency, account.fxFeePct)).replace('.', ',')} % de frais` : ''}
        </p>
      )}
      <div className="split" style={{ gap: 8 }}>
        <button type="button" className="btn sm scan-btn" onClick={() => camRef.current?.click()}><Camera size={16} />Scanner un ticket</button>
        {attachments.map((m) => <AttachmentThumb key={m.id} meta={m} />)}
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onTicket(e.target.files?.[0])} />
      </div>
      {scan && <p className="faint" role="status" style={{ margin: 0 }}>{scan}</p>}
      <input className="input" value={payee} onChange={(e) => { setPayee(e.target.value); const g = guess(e.target.value); if (g) setCategoryId(g) }} placeholder="Où ? (commerçant, facultatif)" aria-label="Commerçant" />
      {frequent.length > 0 && !payee && (
        <div className="chips" aria-label="Commerçants habituels">
          {frequent.map((f) => <button key={f.payee} type="button" className="chip" onClick={() => pickFrequent(f)}>{f.payee}</button>)}
        </div>
      )}

      {creatingCat && <CategoryEditor kind="expense" onDone={(c) => { setCreatingCat(false); setCategoryId(c.id) }} onCancel={() => setCreatingCat(false)} />}
      <div className="quick-cats" role="group" aria-label="Catégorie">
        {cats.map((c) => (
          <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
            <CatIcon icon={c.icon} color={c.color} small /><span>{c.name}</span>
          </button>
        ))}
        {!showAll && <button type="button" onClick={() => setShowAll(true)}><span className="cat-icon sm" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>…</span><span>Autres</span></button>}
        {showAll && <button type="button" onClick={() => setCreatingCat(true)}><span className="cat-icon sm" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>+</span><span>Nouvelle</span></button>}
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
      <button type="button" className="quick-other" data-native-enter onClick={() => setOther(true)}>Autre chose ? Revenu, virement, abonnement…</button>
      <Dialog open={other} onClose={() => setOther(false)} title="Autre chose ?">
        <div className="quick-grid">
          {OTHER.map((i) => <Link key={i.to} to={i.to} replace>{i.icon}{i.label}</Link>)}
        </div>
      </Dialog>
      <button className="btn primary block quick-save" disabled={!isValidAmount(value) || !account} onClick={save}>
        Enregistrer {isValidAmount(value) ? formatMoney(value, currency) : ''}
      </button>
      <p className="quick-hint desk-only">Tapez le montant au clavier · <kbd>Entrée</kbd> enregistrer · <kbd>Échap</kbd> fermer</p>
    </main>
  )
}
