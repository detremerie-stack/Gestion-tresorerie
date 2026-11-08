import type { Category, CategoryKind } from '../data/types'
import { CatIcon } from './Icon'

export function CategoryPicker({ categories, kind, value, onChange }: { categories: Category[]; kind: CategoryKind; value?: string; onChange: (id: string) => void }) {
  const list = categories.filter((c) => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return (
    <div className="cat-grid" role="group" aria-label="Catégorie">
      {list.map((c) => (
        <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <CatIcon icon={c.icon} color={c.color} small />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}
