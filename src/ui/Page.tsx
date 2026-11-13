import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOP_LEVEL } from './Shell'

export function Page({ title, back, actions, aside, wide, children }: {
  title: string
  back?: boolean | string
  actions?: ReactNode
  aside?: ReactNode
  /** Contenu large sur PC (1200 px au lieu de 720). */
  wide?: boolean
  children: ReactNode
}) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  // Sur PC, les écrans de la barre latérale n'ont pas besoin de flèche « Retour ».
  const top = TOP_LEVEL.includes(pathname)
  return (
    <main className={`page${wide ? ' wide' : ''}`}>
      <header className="page-header">
        {back && (
          <button className={`icon-btn no-print${top ? ' phone-only' : ''}`} aria-label="Retour" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
            <ArrowLeft size={22} />
          </button>
        )}
        <h1>{title}</h1>
        {aside && <div className="aside">{aside}</div>}
        {actions}
      </header>
      {children}
    </main>
  )
}

export function Section({ title, action, className, children }: { title?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`section${className ? ` ${className}` : ''}`}>
      {(title || action) && (
        <h2 className="section-title">
          <span>{title}</span>
          {action}
        </h2>
      )}
      {children}
    </section>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children}
    </div>
  )
}
