import { X } from 'lucide-react'
import { useId, useState } from 'react'

export function TagInput({ label, value, onChange, suggestions }: { label: string; value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const add = (t: string) => {
    const tag = t.trim()
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag])
    setDraft('')
  }
  const rest = suggestions.filter((s) => !value.includes(s))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {value.length > 0 && (
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {value.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed="true" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Retirer ${t}`}>
              {t} <X size={14} />
            </button>
          ))}
        </div>
      )}
      <input
        id={id}
        className="input"
        value={draft}
        placeholder="Ajouter une étiquette…"
        list={`${id}-list`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={`${id}-list`}>
        {rest.map((s) => <option key={s} value={s} />)}
      </datalist>
      {rest.length > 0 && (
        <div className="chips">
          {rest.slice(0, 12).map((s) => (
            <button key={s} type="button" className="chip" onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  )
}
