import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Cloud, FileText, HandCoins, Landmark, LineChart, PiggyBank, Plane, Settings, Smartphone, Tags, Upload, Wand2, FolderOpen } from 'lucide-react'
import { Page } from '../ui/Page'
import { useStore } from '../data/store'
import { InstallCard } from '../ui/install'

type Item = { to: string; icon: typeof Cloud; label: string; sub: string }
const GROUPS: { title: string; items: Item[]; advanced?: boolean }[] = [
  { title: 'Mon argent', items: [
    { to: '/rapports', icon: BarChart3, label: 'Où part notre argent', sub: 'Les dépenses par catégorie, mois après mois' },
    { to: '/previsionnel', icon: LineChart, label: 'Les mois à venir', sub: 'Combien il restera fin de mois, salaires et factures prévus' },
    { to: '/comptes', icon: Landmark, label: 'Nos comptes', sub: 'Les soldes : Banque de Tahiti, American Express, espèces' },
    { to: '/prets', icon: HandCoins, label: 'Nos crédits', sub: 'Ce qu’il reste à rembourser et jusqu’à quand' },
  ] },
  { title: 'Projets', items: [
    { to: '/voyages', icon: Plane, label: 'Voyages', sub: 'Préparer le budget, suivre les dépenses sur place' },
    { to: '/budgets', icon: PiggyBank, label: 'Limites de dépenses', sub: 'Se fixer un maximum par mois (courses, restos…)' },
    { to: '/documents', icon: FolderOpen, label: 'Tickets et factures', sub: 'Les photos jointes aux dépenses' },
  ] },
  { title: 'Réglages', items: [
    { to: '/parametres/synchro', icon: Cloud, label: 'Partage Lionel & Véra', sub: 'Voir les mêmes données sur les deux téléphones' },
    { to: '/parametres', icon: Settings, label: 'Réglages', sub: 'Affichage simple ou complet, thème, sauvegarde' },
  ] },
  { title: 'Outils avancés', advanced: true, items: [
    { to: '/import', icon: Upload, label: 'Importer un relevé de banque', sub: 'Fichier CSV ou OFX' },
    { to: '/releve', icon: FileText, label: 'Imprimer un relevé', sub: 'Par compte et par période, en PDF' },
    { to: '/parametres/categories', icon: Tags, label: 'Catégories', sub: 'Ajouter, renommer, changer le pictogramme' },
    { to: '/parametres/regles', icon: Wand2, label: 'Classement automatique', sub: 'Quel commerçant va dans quelle catégorie' },
    { to: '/parametres/wallet', icon: Smartphone, label: 'Paiements Google Wallet', sub: 'Pré-remplir une dépense après un paiement' },
  ] },
]

function Rows({ items, household }: { items: Item[]; household?: string }) {
  return (
    <div className="card flush">
      <ul className="list">
        {items.map(({ to, icon: I, label, sub }) => (
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
  )
}

export default function More() {
  const household = useStore((s) => s.sync.householdName)
  const complet = useStore((s) => s.settings.mode === 'complet')
  return (
    <Page title="Menu">
      <InstallCard />
      {GROUPS.map((g) => g.advanced ? (
        <details key={g.title} className="menu-group" open={complet}>
          <summary>{g.title}</summary>
          <Rows items={g.items} />
        </details>
      ) : (
        <section key={g.title} className="section">
          <h2 className="section-title"><span>{g.title}</span></h2>
          <Rows items={g.items} household={household} />
        </section>
      ))}
      <p className="faint" style={{ textAlign: 'center' }}>Fare Moni · version {__APP_VERSION__} · sans publicité</p>
    </Page>
  )
}
