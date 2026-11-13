import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Boîte de dialogue : feuille du bas sur téléphone, boîte centrée sur PC (desktop.css).
 * `<dialog>` natif ouvert par `showModal()` : le reste de la page est inerte, Tab reste dans la boîte,
 * Échap ferme. À la fermeture, le focus revient à l'élément qui l'a ouverte.
 */
export function Dialog({ open, onClose, title, children, actions }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const d = ref.current
    if (!d || !open) return
    opener.current = document.activeElement
    if (!d.open) d.showModal()
    const first = d.querySelector<HTMLElement>('[data-autofocus]') ?? d.querySelector<HTMLElement>('input, select, textarea') ?? d.querySelector<HTMLElement>('.dialog-close')
    first?.focus()
    document.documentElement.classList.add('dialog-open')
    return () => {
      if (d.open) d.close()
      document.documentElement.classList.remove('dialog-open')
      const o = opener.current as HTMLElement | null
      if (o && typeof o.focus === 'function' && o.isConnected) o.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); close.current() }}
      onClick={(e) => { if (e.target === e.currentTarget) close.current() }}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn dialog-close" aria-label="Fermer" onClick={() => close.current()}><X size={22} /></button>
        </div>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </dialog>
  )
}
