import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Cloud, FileText, HandCoins, Landmark, LineChart, PiggyBank, Plane, Settings, Smartphone, Tags, Upload, Wand2, FolderOpen } from 'lucide-react'
import { Page } from '../ui/Page'
import { useStore } from '../data/store'
import { InstallCard } from '../ui/install'

type Item = { to: string; icon: typeof Cloud; label: string; sub: string }
/** Menu téléphone (spécification 21 § 2) : 3 sections, sans accordéon, identique en Simple et Complet. */
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Le plus utile', items: [
    { to: '/import', icon: Upload, label: 'Importer un relevé', sub: 'Le fichier de la banque, une fois par mois' },
    { to: '/previsionnel', icon: LineChart, label: 'Les mois à venir', sub: 'Salaires et factures prévus, mois après mois' },
    { to: '/rapports', icon: BarChart3, label: 'Où part notre argent', sub: 'Les dépenses par catégorie, mois après mois' },
  ] },
  { title: 'Notre argent', items: [
    { to: '/comptes', icon: Landmark, label: 'Comptes', sub: 'Les soldes de chaque compte' },
    { to: '/prets', icon: HandCoins, label: 'Crédits', sub: 'Ce qu’il reste à rembourser et jusqu’à quand' },
    { to: '/budgets', icon: PiggyBank, label: 'Limites de dépenses', sub: 'Se fixer un maximum par mois (courses, restos…)' },
    { to: '/voyages', icon: Plane, label: 'Voyages', sub: 'Préparer le budget, suivre les dépenses sur place' },
    { to: '/documents', icon: FolderOpen, label: 'Tickets et factures', sub: 'Les photos jointes aux dépenses' },
    { to: '/releve', icon: FileText, label: 'Imprimer un relevé', sub: 'Par compte et par période, en PDF' },
  ] },
  { title: 'Réglages', items: [
    { to: '/parametres/synchro', icon: Cloud, label: 'Partage', sub: 'Voir les mêmes données sur les deux téléphones' },
    { to: '/parametres', icon: Settings, label: 'Réglages', sub: 'Affichage simple ou complet, thème, copie de sécurité' },
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
  return (
    <Page title="Menu">
      <InstallCard />
      {GROUPS.map((g) => (
        <section key={g.title} className="section">
          <h2 className="section-title"><span>{g.title}</span></h2>
          <Rows items={g.items} household={household} />
        </section>
      ))}
      <p className="faint" style={{ textAlign: 'center' }}>Fare Moni · version {__APP_VERSION__} · sans publicité</p>
    </Page>
  )
}
