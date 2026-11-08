import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListX, Search, Upload } from 'lucide-react'
import { useMap, useStore } from '../data/store'
import { COMMON, useAccounts, useMemberName, useMembers, useTransactions } from '../data/hooks'
import { addMonths, formatLongDate, monthKey, monthLabel, today } from '../lib/dates'
import { normalize } from '../lib/id'
import { signedXPF, totals } from '../lib/reports'
import type { Transaction, TxType } from '../data/types'
import { Money } from '../ui/Money'
import { Empty, Page } from '../ui/Page'
import { CatIcon } from '../ui/Icon'

export default function Transactions() {
  const [params, setParams] = useSearchParams()
  const rates = useStore((s) => s.settings.rates)
  const all = useTransactions()
  const cats = useMap('categories')
  const accountsMap = useMap('accounts')
  const accounts = useAccounts(true)
  const members = useMembers()
  const memberName = useMemberName()
  const [q, setQ] = useState('')

  const month = params.get('mois') ?? monthKey(today())
  const type = (params.get('type') ?? 'all') as TxType | 'all'
  const accountId = params.get('compte') ?? ''
  const catId = params.get('cat') ?? ''
  const member = params.get('membre') ?? ''
  const tag = params.get('tag') ?? ''
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const nq = normalize(q)
    return all.filter((t) => {
      if (!q && monthKey(t.date) !== month) return false
      if (type !== 'all' && t.type !== type) return false
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false
      if (catId && (catId === 'none' ? !!t.categoryId : t.categoryId !== catId)) return false
      if (member && (t.member ?? COMMON) !== member) return false
      if (tag && !t.tags.includes(tag)) return false
      if (nq) {
        const hay = normalize([t.payee, t.note, t.rawLabel, cats.get(t.categoryId ?? '')?.name, ...t.tags].filter(Boolean).join(' '))
        if (!hay.includes(nq)) return false
      }
      return true
    })
  }, [all, q, month, type, accountId, catId, member, tag, cats])

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [filtered])

  const tot = totals(filtered, accountsMap, rates)
  const activeCat = catId && catId !== 'none' ? cats.get(catId) : undefined

  return (
    <Page title="Opérations" actions={<Link to="/import" className="icon-btn" aria-label="Importer un relevé"><Upload size={20} /></Link>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="search">
          <Search size={18} />
          <input className="input" type="search" placeholder="Rechercher (toutes périodes)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        </div>
        {!q && (
          <div className="month-nav">
            <button className="icon-btn" aria-label="Mois précédent" onClick={() => setParam('mois', addMonths(month, -1))}><ChevronLeft /></button>
            <strong>{monthLabel(month)}</strong>
            <button className="icon-btn" aria-label="Mois suivant" onClick={() => setParam('mois', addMonths(month, 1))}><ChevronRight /></button>
          </div>
        )}
        <div className="chips" role="group" aria-label="Type">
          {([['all', 'Tout'], ['expense', 'Dépenses'], ['income', 'Revenus'], ['transfer', 'Virements']] as const).map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={type === v} onClick={() => setParam('type', v === 'all' ? '' : v)}>{l}</button>
          ))}
        </div>
        <div className="grid-2">
          <select className="input" aria-label="Compte" value={accountId} onChange={(e) => setParam('compte', e.target.value)}>
            <option value="">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" aria-label="Membre" value={member} onChange={(e) => setParam('membre', e.target.value)}>
            <option value="">Tout le foyer</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={COMMON}>Commun</option>
          </select>
        </div>
        {(activeCat || catId === 'none' || tag) && (
          <div className="chips">
            {catId && <button className="chip" aria-pressed="true" onClick={() => setParam('cat', '')}>{activeCat?.name ?? 'Sans catégorie'} ✕</button>}
            {tag && <button className="chip" aria-pressed="true" onClick={() => setParam('tag', '')}>#{tag} ✕</button>}
          </div>
        )}
      </div>

      <div className="kpis card">
        <div className="kpi"><span className="label">Rentrées</span><Money className="value income" value={tot.income} /></div>
        <div className="kpi"><span className="label">Sorties</span><Money className="value expense" value={-tot.expense} /></div>
      </div>

      {groups.length === 0 ? (
        <Empty icon={<ListX size={40} />} title="Aucune opération">
          <span>Ajoutez une dépense avec le bouton +, ou importez un relevé bancaire.</span>
          <Link className="btn" to="/import"><Upload size={18} />Importer un relevé</Link>
        </Empty>
      ) : (
        <div className="card flush">
          {groups.map(([date, items]) => {
            const dayNet = items.reduce((s, t) => s + signedXPF(t, accountsMap, rates), 0)
            return (
              <div key={date}>
                <div className="day-head">
                  <span style={{ textTransform: 'capitalize' }}>{formatLongDate(date)}</span>
                  <Money value={dayNet} sign />
                </div>
                <ul className="list">
                  {items.map((t) => {
                    const cat = cats.get(t.categoryId ?? '')
                    const acc = accountsMap.get(t.accountId)
                    const to = accountsMap.get(t.toAccountId ?? '')
                    const sign = t.type === 'expense' ? -1 : 1
                    const who = memberName(t.member)
                    return (
                      <li key={t.id}>
                        <Link className="row" to={`/operations/${t.id}`}>
                          {t.type === 'transfer' ? <CatIcon icon="undo-2" color="#64748B" /> : <CatIcon icon={cat?.icon} color={cat?.color} />}
                          <div className="main">
                            <span className="title">
                              {t.type === 'transfer' ? `Virement vers ${to?.name ?? '?'}` : t.payee || cat?.name || 'Sans catégorie'}
                            </span>
                            <span className="sub">
                              {[t.type !== 'transfer' && t.payee ? cat?.name ?? 'Sans catégorie' : null, acc?.name, who, ...t.tags.map((x) => '#' + x)].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <div className="end">
                            <Money className={`amount ${t.type === 'transfer' ? '' : t.type}`} value={t.type === 'transfer' ? t.amount : sign * t.amount} currency={acc?.currency} sign={t.type === 'income'} />
                            {t.originalCurrency && <span className="faint"><Money value={t.originalAmount ?? 0} currency={t.originalCurrency} /></span>}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Page>
  )
}
