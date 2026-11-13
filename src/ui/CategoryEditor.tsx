import { useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../data/store'
import { PALETTE } from '../data/defaults'
import type { Category, CategoryKind } from '../data/types'
import { CatIcon, ICON_GROUPS, iconsOf } from './Icon'
import { Segmented, Swatches, TextField } from './Field'

/** Création / modification d'une catégorie : nom, type, pictogramme (recherche + groupes), couleur. */
export function CategoryEditor({ initial, kind, onDone, onCancel }: { initial?: Partial<Category>; kind: CategoryKind; onDone: (c: Category) => void; onCancel: () => void }) {
  const upsert = useStore((s) => s.upsert)
  const [name, setName] = useState(initial?.name ?? '')
  const [k, setK] = useState<CategoryKind>(initial?.kind ?? kind)
  const [icon, setIcon] = useState(initial?.icon ?? 'circle-dashed')
  const [color, setColor] = useState(initial?.color ?? PALETTE[0])
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | undefined>()
  const list = iconsOf(q ? undefined : group, q)
  const save = () => {
    if (!name.trim()) return
    onDone(upsert('categories', { ...initial, name: name.trim(), kind: k, icon, color }))
  }
  return (
    <div className="card form">
      <div className="split" style={{ gap: 12 }}>
        <CatIcon icon={icon} color={color} />
        <div style={{ flex: 1 }}><TextField label="Nom de la catégorie" value={name} onChange={setName} autoFocus placeholder="Ex. Sport, Matériel informatique…" /></div>
      </div>
      {!initial?.id && <Segmented label="Type" value={k} onChange={setK} options={[{ value: 'expense', label: 'Dépense' }, { value: 'income', label: 'Revenu' }]} />}
      <div className="field">
        <span className="label">Pictogramme</span>
        <div className="search"><Search size={18} /><input className="input" type="search" placeholder="Chercher : voiture, surf, ordinateur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un pictogramme" /></div>
        {!q && (
          <div className="chips">
            <button type="button" className="chip" aria-pressed={!group} onClick={() => setGroup(undefined)}>Tous</button>
            {ICON_GROUPS.map((g) => <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
          </div>
        )}
        <div className="icon-grid" role="group" aria-label="Pictogrammes">
          {list.map((i) => (
            <button key={i} type="button" aria-pressed={icon === i} aria-label={i} onClick={() => setIcon(i)}><CatIcon icon={i} color={icon === i ? color : '#94A3B8'} small /></button>
          ))}
          {list.length === 0 && <span className="faint">Aucun pictogramme pour « {q} ».</span>}
        </div>
      </div>
      <div className="field"><span className="label">Couleur</span><Swatches value={color} onChange={setColor} colors={[...PALETTE, '#7C2D12', '#9D174D', '#C2410C', '#0369A1']} /></div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={save}>Enregistrer</button>
        <button type="button" className="btn" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}
