import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function Page({ title, back, actions, aside, children }: {
  title: string
  back?: boolean | string
  actions?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  const nav = useNavigate()
  return (
    <main className="page">
      <header className="page-header">
        {back && (
          <button className="icon-btn no-print" aria-label="Retour" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
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

export function Section({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
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
