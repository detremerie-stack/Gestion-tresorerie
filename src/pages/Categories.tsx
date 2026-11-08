import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { useCategories } from '../data/hooks'
import { PALETTE } from '../data/defaults'
import type { Category, CategoryKind } from '../data/types'
import { Page } from '../ui/Page'
import { Segmented, Swatches, TextField } from '../ui/Field'
import { CatIcon, ICONS } from '../ui/Icon'
import { useToast } from '../ui/toast'

export default function CategoriesPage() {
  const [kind, setKind] = useState<CategoryKind>('expense')
  const categories = useCategories().filter((c) => c.kind === kind)
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)

  const save = () => {
    if (!edit?.name?.trim()) return
    upsert('categories', { ...edit, name: edit.name.trim(), kind: edit.kind ?? kind, icon: edit.icon ?? 'circle-dashed', color: edit.color ?? PALETTE[0] })
    setEdit(null)
  }

  return (
    <Page title="Catégories" back>
      <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setEdit(null) }} options={[{ value: 'expense', label: 'Dépenses' }, { value: 'income', label: 'Revenus' }]} />
      {edit ? (
        <div className="card form">
          <TextField label="Nom" value={edit.name ?? ''} onChange={(v) => setEdit({ ...edit, name: v })} autoFocus />
          <div className="field"><span className="label">Icône</span>
            <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}>
              {Object.keys(ICONS).map((i) => (
                <button key={i} type="button" aria-pressed={edit.icon === i} aria-label={i} onClick={() => setEdit({ ...edit, icon: i })}>
                  <CatIcon icon={i} color={edit.color ?? PALETTE[0]} small />
                </button>
              ))}
            </div>
          </div>
          <div className="field"><span className="label">Couleur</span><Swatches value={edit.color ?? PALETTE[0]} onChange={(c) => setEdit({ ...edit, color: c })} colors={PALETTE} /></div>
          <div className="btn-row">
            <button className="btn primary" onClick={save}>Enregistrer</button>
            <button className="btn" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="btn primary" onClick={() => setEdit({ kind, icon: 'circle-dashed', color: PALETTE[0] })}>Nouvelle catégorie</button>
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
