import type { ReactNode } from 'react'
import { useId } from 'react'

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function TextField({ label, value, onChange, hint, error, ...rest }: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  error?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />
    </Field>
  )
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Swatches({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="swatches" role="group" aria-label="Couleur">
      {colors.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value.toLowerCase() === c.toLowerCase()} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}
