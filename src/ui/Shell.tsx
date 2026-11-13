import { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Cloud, FolderOpen, HandCoins, Home, Landmark, LineChart, List, MoreHorizontal, PiggyBank, Plane, Plus, Repeat, Settings, Upload } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { globalShortcut } from './keys'

type Entry = { to: string; label: string; icon: LucideIcon }

/** Barre latérale du PC (≥ 900 px), dans l'ordre de la spécification 21 § 2. */
export const SIDE_MAIN: Entry[] = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/operations', label: 'Historique', icon: List },
  { to: '/abonnements', label: 'Abonnements', icon: Repeat },
  { to: '/previsionnel', label: 'Les mois à venir', icon: LineChart },
  { to: '/rapports', label: 'Où part notre argent', icon: BarChart3 },
  { to: '/import', label: 'Importer un relevé', icon: Upload },
]
export const SIDE_MORE: Entry[] = [
  { to: '/voyages', label: 'Voyages', icon: Plane },
  { to: '/prets', label: 'Crédits', icon: HandCoins },
  { to: '/comptes', label: 'Comptes', icon: Landmark },
  { to: '/budgets', label: 'Limites de dépenses', icon: PiggyBank },
  { to: '/documents', label: 'Tickets et factures', icon: FolderOpen },
]
export const SIDE_FOOT: Entry[] = [
  { to: '/parametres', label: 'Réglages', icon: Settings },
  { to: '/parametres/synchro', label: 'Partage', icon: Cloud },
]

/** Écrans de premier niveau sur PC : la flèche « Retour » y est masquée (la barre latérale suffit). */
export const TOP_LEVEL = [...SIDE_MAIN, ...SIDE_MORE, ...SIDE_FOOT].map((e) => e.to)

/** Entrée active : l'écran lui-même ou une de ses sous-pages (Partage est à part de Réglages). */
export function isSideActive(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/'
  if (to === '/parametres' && pathname.startsWith('/parametres/synchro')) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

function SideLink({ e }: { e: Entry }) {
  const I = e.icon
  const { pathname } = useLocation()
  const on = isSideActive(e.to, pathname)
  return (
    <Link to={e.to} className={on ? 'active' : undefined} aria-current={on ? 'page' : undefined}>
      <I size={20} strokeWidth={1.75} aria-hidden="true" />{e.label}
    </Link>
  )
}

function SideNav() {
  return (
    <aside className="side no-print" aria-label="Navigation principale">
      <span className="side-brand"><img src="./icon.svg" alt="" width={32} height={32} />Fare Moni</span>
      <Link to="/rapide" className="side-new"><Plus size={18} aria-hidden="true" />Nouvelle dépense <kbd>N</kbd></Link>
      <nav aria-label="Écrans">
        {SIDE_MAIN.map((e) => <SideLink key={e.to} e={e} />)}
        <hr />
        {SIDE_MORE.map((e) => <SideLink key={e.to} e={e} />)}
      </nav>
      <nav className="side-foot" aria-label="Réglages">
        <hr />
        {SIDE_FOOT.map((e) => <SideLink key={e.to} e={e} />)}
      </nav>
    </aside>
  )
}

/** Barre du bas (téléphone). (+) = dépense rapide dans les deux modes (Q5). */
function BottomNav() {
  return (
    <nav className="nav no-print" aria-label="Navigation principale">
      <ul>
        <li><NavLink to="/" end><Home size={22} />Accueil</NavLink></li>
        <li><NavLink to="/operations"><List size={22} />Historique</NavLink></li>
        <li className="fab-slot">
          <Link className="fab" to="/rapide" aria-label="Nouvelle dépense"><Plus size={28} /></Link>
        </li>
        <li><NavLink to="/abonnements"><Repeat size={22} />Abonnements</NavLink></li>
        <li><NavLink to="/plus"><MoreHorizontal size={22} />Menu</NavLink></li>
      </ul>
    </nav>
  )
}

/** Raccourcis globaux : N = nouvelle dépense, / = rechercher dans l'Historique. */
function useGlobalShortcuts() {
  const navigate = useNavigate()
  const loc = useLocation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = globalShortcut(e, !!document.querySelector('dialog[open]'))
      if (!action) return
      e.preventDefault()
      if (action === 'new') navigate('/rapide')
      else {
        const input = document.querySelector<HTMLInputElement>('#historique-recherche')
        if (input) input.focus()
        else navigate('/operations', { state: { focusSearch: true } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, loc.pathname])
}

function Shortcuts() {
  useGlobalShortcuts()
  return null
}

/**
 * Coquille : barre du bas (téléphone) et barre latérale (PC ≥ 900 px de large et 500 px de haut).
 * Les deux sont dans le DOM ; le CSS masque celle qui ne sert pas (aucun matchMedia).
 */
export function Shell() {
  const loc = useLocation()
  if (loc.pathname === '/rapide') return null
  return (
    <>
      <Shortcuts />
      <SideNav />
      <BottomNav />
    </>
  )
}
