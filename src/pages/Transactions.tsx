import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Archive, ChevronLeft, ChevronRight, ListX, Paperclip, Search, Upload } from 'lucide-react'
import { useMap, useStore } from '../data/store'
import { COMMON, useAccounts, useMemberName, useMembers, useTransactions } from '../data/hooks'
import { addInterval, addMonths, formatDate, formatLongDate, formatShortDate, monthKey, monthLabel, today } from '../lib/dates'
import { archiveStart } from '../lib/forecast'
import { PAGE_SIZE, buildSearchIndex, filterTransactions, groupByDay } from '../lib/history'
import { signedXPF, totals } from '../lib/reports'
import type { TxType } from '../data/types'
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

  // Recherche fluide : index normalisé calculé une fois, frappe différée, 200 lignes à la fois.
  const index = useMemo(() => buildSearchIndex(all, cats), [all, cats])
  const dq = useDeferredValue(q)
  const filtered = useMemo(
    () => filterTransactions(all, { q: dq, month, archives, archiveFrom, type, accountId, catId, member, tag, common: COMMON }, index),
    [all, dq, month, type, accountId, catId, member, tag, index, archives, archiveFrom],
  )
  const [limit, setLimit] = useState(PAGE_SIZE)
  useEffect(() => setLimit(PAGE_SIZE), [dq, month, type, accountId, catId, member, tag, archives])
  const shown = filtered.length > limit ? filtered.slice(0, limit) : filtered
  const groups = useMemo(() => groupByDay(shown), [shown])

  const tot = totals(filtered, accountsMap, rates)
  const activeCat = catId && catId !== 'none' ? cats.get(catId) : undefined

  return (
    <Page title="Historique" wide actions={<Link to="/import" className="icon-btn" aria-label="Importer un relevé"><Upload size={20} /></Link>}>
      <div className="stack history-filters" style={{ gap: 12 }}>
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
          {([['all', 'Tout'], ['expense', 'Dépenses'], ['income', 'Revenus'], ['transfer', 'Entre nos comptes']] as const).map(([v, l]) => (
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
        <div className="kpi"><span className="label">Entrées</span><Money className="value income" value={tot.income} /></div>
        <div className="kpi"><span className="label">Sorties</span><Money className="value expense" value={-tot.expense} /></div>
      </div>

      {groups.length === 0 ? (
        <Empty icon={<ListX size={40} />} title="Aucune opération">
          <span>Ajoutez une dépense avec le bouton +, ou importez le fichier de la banque.</span>
          <Link className="btn" to="/import"><Upload size={18} />Importer un relevé</Link>
        </Empty>
      ) : (
        <>
        <div className="card flush tx-table">
          <div className="tx-head desk-only" aria-hidden="true"><span /><span>Date</span><span>Description</span><span>Catégorie</span><span>Compte</span><span className="r">Montant</span></div>
          {groups.map(([date, items]) => {
            const dayNet = items.reduce((s, t) => s + signedXPF(t, accountsMap, rates), 0)
            return (
              <div key={date}>
                <div className="day-head">
                  <span>{formatLongDate(date)}</span>
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
                        <Link className="row tx-row" to={`/operations/${t.id}`}>
                          {t.type === 'transfer' ? <CatIcon icon="undo-2" color="#64748B" /> : <CatIcon icon={cat?.icon} color={cat?.color} />}
                          <span className="col-date desk-only">{formatShortDate(t.date)}</span>
                          <div className="main">
                            <span className="title">
                              {t.type === 'transfer' ? `Vers ${to?.name ?? '?'}` : t.payee || cat?.name || 'Sans catégorie'}
                            </span>
                            <span className="sub phone-only">
                              {[t.type !== 'transfer' && t.payee ? cat?.name ?? 'Sans catégorie' : null, acc?.name, who, ...t.tags.map((x) => '#' + x)].filter(Boolean).join(' · ')}
                            </span>
                            {/* PC étroit (900–1279 px) : le compte passe sous la description, la colonne Compte est masquée. */}
                            {(acc || who || t.tags.length > 0) && (
                              <span className="sub desk-only">
                                {acc && <span className="acc-inline">{acc.name}{who || t.tags.length ? ' · ' : ''}</span>}
                                {[who, ...t.tags.map((x) => '#' + x)].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                          <span className="col-cat desk-only">{t.type === 'transfer' ? 'Entre nos comptes' : cat?.name ?? 'Sans catégorie'}</span>
                          <span className="col-acc desk-only">{acc?.name}</span>
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
        {filtered.length > shown.length && (
          <button className="btn" onClick={() => setLimit((n) => n + PAGE_SIZE)}>Voir plus ({filtered.length - shown.length} de plus)</button>
        )}
        </>
      )}
    </Page>
  )
}
