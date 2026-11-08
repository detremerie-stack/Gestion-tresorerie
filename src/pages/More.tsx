import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Cloud, FileText, HandCoins, Landmark, LineChart, PiggyBank, Plane, Settings, Tags, Upload, Wand2 } from 'lucide-react'
import { Page } from '../ui/Page'
import { useStore } from '../data/store'
import { InstallCard } from '../ui/install'

const ITEMS = [
  { to: '/previsionnel', icon: LineChart, label: 'Prévisionnel', sub: 'Solde prévu mois par mois, entrées et sorties prévues' },
  { to: '/voyages', icon: Plane, label: 'Voyages', sub: 'Budget, épargne et dépenses de vos voyages' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets', sub: 'Plafonds mensuels par catégorie' },
  { to: '/rapports', icon: BarChart3, label: 'Rapports', sub: 'Où part l’argent, mois après mois' },
  { to: '/comptes', icon: Landmark, label: 'Comptes', sub: 'Banque de Tahiti, AmEx, Deblock, espèces' },
  { to: '/prets', icon: HandCoins, label: 'Prêts', sub: 'Capital restant dû, échéancier, intérêts' },
  { to: '/import', icon: Upload, label: 'Importer un relevé', sub: 'Fichier CSV ou OFX de la banque' },
  { to: '/releve', icon: FileText, label: 'Relevé imprimable', sub: 'Par compte et par période, en PDF' },
  { to: '/parametres/categories', icon: Tags, label: 'Catégories', sub: 'Dépenses et revenus' },
  { to: '/parametres/regles', icon: Wand2, label: 'Règles automatiques', sub: 'Catégoriser les relevés importés' },
  { to: '/parametres/synchro', icon: Cloud, label: 'Synchronisation', sub: 'Partager avec Véra / Lionel' },
  { to: '/parametres', icon: Settings, label: 'Paramètres', sub: 'Taux de change, thème, sauvegarde' },
]

export default function More() {
  const household = useStore((s) => s.sync.householdName)
  return (
    <Page title="Plus">
      <InstallCard />
      <div className="card flush">
        <ul className="list">
          {ITEMS.map(({ to, icon: I, label, sub }) => (
            <li key={to}>
              <Link to={to} className="row" style={{ color: 'inherit' }}>
                <span className="cat-icon sm" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><I size={18} /></span>
                <div className="main">
                  <span className="title">{label}</span>
                  <span className="sub">{to === '/parametres/synchro' && household ? `Foyer « ${household} » connecté` : sub}</span>
                </div>
                <ChevronRight size={18} className="faint" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="faint" style={{ textAlign: 'center' }}>Moni · version {__APP_VERSION__} · sans publicité</p>
    </Page>
  )
}
