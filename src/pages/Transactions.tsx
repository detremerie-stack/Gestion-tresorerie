import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Archive, ChevronLeft, ChevronRight, ListX, Paperclip, Search, Upload } from 'lucide-react'
import { useMap, useStore } from '../data/store'
import { COMMON, useAccounts, useMemberName, useMembers, useTransactions } from '../data/hooks'
import { addInterval, addMonths, formatDate, formatLongDate, monthKey, monthLabel, today } from '../lib/dates'
import { archiveStart } from '../lib/forecast'
import { normalize } from '../lib/id'
import { signedXPF, totals } from '../lib/reports'
import type { Transaction, TxType } from '../data/types'
import { Money } from '../ui/Money'
import { Empty, Page } from '../ui/Page'
import { CatIcon } from '../ui/Icon'

export default function Transactions() {
  // Raccourci « / » : arrivée sur l'Historique avec le curseur dans la recherche.
  const focusSearch = (useLocation().state as { focusSearch?: boolean } | null)?.focusSearch
  const [params, setParams] = useSearchParams()
  const rates = useStore((s) => s.settings.rates)
  const all = useTransactions()
  const cats = useMap('categories')
  const accountsMap = useMap('accounts')
  const accounts = useAccounts(true)
  const members = useMembers()
  const memberName = useMemberName()
  const [q, setQ] = useState('')
  const visibleYears = useStore((s) => s.settings.visibleYears ?? 2)
  const archiveFrom = archiveStart(today(), visibleYears)
  const archives = params.get('archives') === '1'
  const complet = useStore((s) => s.settings.mode === 'complet')
  const recentLimit = addInterval(today(), -60, 'day')

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
      if (!archives && t.date < archiveFrom) return false
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
  }, [all, q, month, type, accountId, catId, member, tag, cats, archives, archiveFrom])

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [filtered])

  const tot = totals(filtered, accountsMap, rates)
  const activeCat = catId && catId !== 'none' ? cats.get(catId) : undefined

  return (
    <Page title="Historique" wide actions={<Link to="/import" className="icon-btn" aria-label="Importer un relevé"><Upload size={20} /></Link>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="search">
          <Search size={18} />
          <input id="historique-recherche" className="input" type="search" placeholder="Rechercher (toutes périodes)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" autoFocus={!!focusSearch} />
        </div>
        {!q && (
          <div className="month-nav">
            <button className="icon-btn" aria-label="Mois précédent" disabled={!archives && addMonths(month, -1) < archiveFrom.slice(0, 7)} onClick={() => setParam('mois', addMonths(month, -1))}><ChevronLeft /></button>
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
        {archives ? (
          <div className="callout"><Archive size={18} /><span style={{ flex: 1 }}>Consultation des archives (avant le {formatDate(archiveFrom)}).</span><button className="btn sm" onClick={() => setParam('archives', '')}>Quitter</button></div>
        ) : all.some((t) => t.date < archiveFrom) && (
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => { const n = new URLSearchParams(params); n.set('archives', '1'); n.set('mois', addMonths(archiveFrom.slice(0, 7), -1)); setParams(n, { replace: true }) }}>
            <Archive size={14} />Archives avant {archiveFrom.slice(0, 4)}
          </button>
        )}
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
                            <span className="faint" style={{ display: 'flex', gap: 4 }}>
                              {t.attachments?.length ? <Paperclip size={12} aria-label="Justificatif joint" /> : null}
                              {complet && !t.importHash && t.type !== 'transfer' && t.date >= recentLimit && accountsMap.get(t.accountId)?.type !== 'cash' && <span title="Saisie pas encore retrouvée sur un relevé">pas encore vu à la banque</span>}
                            </span>
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
