import { useMemo, useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useCategories } from '../data/hooks'
import { matchRule } from '../lib/rules'
import { Page, Section } from '../ui/Page'
import { useToast } from '../ui/toast'

export default function RulesPage() {
  const rules = useList('rules')
  const cats = useMap('categories')
  const categories = useCategories()
  const txs = useList('transactions')
  const upsert = useStore((s) => s.upsert)
  const upsertMany = useStore((s) => s.upsertMany)
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState('')

  const sorted = useMemo(() => [...rules].filter((r) => !q || r.pattern.includes(q.toLowerCase())).sort((a, b) => a.pattern.localeCompare(b.pattern)), [rules, q])
  const uncategorized = txs.filter((t) => t.type !== 'transfer' && !t.categoryId)

  const applyToUncategorized = () => {
    const updated = uncategorized.flatMap((t) => {
      const r = matchRule(t.rawLabel ?? t.payee ?? '', rules)
      const cat = r?.categoryId ? cats.get(r.categoryId) : undefined
      return cat && cat.kind === t.type ? [{ ...t, categoryId: cat.id }] : []
    })
    upsertMany('transactions', updated)
    toast(`${updated.length} opération(s) classée(s)`)
  }

  return (
    <Page title="Classement automatique" back>
      <p className="muted" style={{ margin: 0 }}>Si le libellé d'une opération importée contient le mot indiqué, la catégorie est appliquée automatiquement. Les commerces et organismes de Polynésie courants sont déjà inclus.</p>
      {uncategorized.length > 0 && (
        <button className="btn" onClick={applyToUncategorized}><Wand2 size={18} />Appliquer aux {uncategorized.length} opération(s) sans catégorie</button>
      )}
      <Section title="Nouvelle règle">
        <div className="card form">
          <input className="input" placeholder="Mot dans le libellé (ex. « champion »)" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Motif" />
          <div className="input-group">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Catégorie">
              <option value="">Catégorie…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.kind === 'income' ? ' (revenu)' : ''}</option>)}
            </select>
            <button className="btn primary" disabled={!pattern.trim() || !categoryId} onClick={() => { upsert('rules', { pattern: pattern.trim().toLowerCase(), categoryId }); setPattern('') }}><Plus size={18} />Ajouter</button>
          </div>
        </div>
      </Section>
      <Section title={`${rules.length} règles`}>
        <input className="input" type="search" placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrer les règles" />
        <div className="card flush"><ul className="list">
          {sorted.map((r) => (
            <li key={r.id}><div className="row" style={{ minHeight: 48 }}>
              <span className="main"><span className="title">« {r.pattern} »</span><span className="sub">→ {cats.get(r.categoryId ?? '')?.name ?? '—'}</span></span>
              <button className="icon-btn" aria-label={`Supprimer la règle ${r.pattern}`} onClick={() => { remove('rules', r.id); toast('Règle supprimée', { label: 'Annuler', run: () => upsert('rules', { ...r, deleted: false }) }) }}><Trash2 size={18} /></button>
            </div></li>
          ))}
        </ul></div>
      </Section>
    </Page>
  )
}
