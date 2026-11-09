import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { useCategories } from '../data/hooks'
import type { Category, CategoryKind } from '../data/types'
import { Page } from '../ui/Page'
import { Segmented } from '../ui/Field'
import { CatIcon } from '../ui/Icon'
import { CategoryEditor } from '../ui/CategoryEditor'
import { useToast } from '../ui/toast'

export default function CategoriesPage() {
  const [kind, setKind] = useState<CategoryKind>('expense')
  const categories = useCategories().filter((c) => c.kind === kind)
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)

  return (
    <Page title="Catégories" back>
      <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setEdit(null) }} options={[{ value: 'expense', label: 'Dépenses' }, { value: 'income', label: 'Revenus' }]} />
      {edit ? (
        <CategoryEditor key={edit.id ?? 'new'} initial={edit.id ? edit : undefined} kind={kind} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} />
      ) : (
        <button className="btn primary" onClick={() => setEdit({ kind })}>Nouvelle catégorie</button>
      )}
      <div className="card flush">
        <ul className="list">
          {categories.map((c) => (
            <li key={c.id}>
              <div className="row">
                <button className="row" style={{ padding: 0, minHeight: 0 }} onClick={() => setEdit(c)}>
                  <CatIcon icon={c.icon} color={c.color} small />
                  <span className="main title">{c.name}</span>
                </button>
                <button className="icon-btn" aria-label={`Supprimer ${c.name}`} onClick={() => { remove('categories', c.id); toast(`« ${c.name} » supprimée`, { label: 'Annuler', run: () => upsert('categories', { ...c, deleted: false }) }) }}><Trash2 size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  )
}
