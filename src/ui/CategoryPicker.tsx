import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Category, CategoryKind } from '../data/types'
import { CatIcon } from './Icon'
import { CategoryEditor } from './CategoryEditor'

export function CategoryPicker({ categories, kind, value, onChange }: { categories: Category[]; kind: CategoryKind; value?: string; onChange: (id: string) => void }) {
  const [creating, setCreating] = useState(false)
  const list = categories.filter((c) => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  if (creating) return <CategoryEditor kind={kind} onDone={(c) => { setCreating(false); onChange(c.id) }} onCancel={() => setCreating(false)} />
  return (
    <div className="cat-grid" role="group" aria-label="Catégorie">
      {list.map((c) => (
        <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <CatIcon icon={c.icon} color={c.color} small />
          <span>{c.name}</span>
        </button>
      ))}
      <button type="button" onClick={() => setCreating(true)}>
        <span className="cat-icon sm" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Plus size={16} /></span>
        <span>Nouvelle</span>
      </button>
    </div>
  )
}
