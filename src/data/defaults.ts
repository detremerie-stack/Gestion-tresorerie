import type { Account, Category, Member, Rule, Subscription } from './types'

const now = () => new Date().toISOString()

type Seed<T> = Omit<T, 'updatedAt'>
const stamp = <T,>(xs: Seed<T>[]): T[] => xs.map((x) => ({ ...x, updatedAt: now() }) as T)

export const PALETTE = ['#0E7490', '#0F766E', '#15803D', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#4F46E5', '#2563EB', '#475569']

export function defaultMembers(): Member[] {
  return stamp<Member>([
    { id: 'm-lionel', name: 'Lionel', color: '#0E7490' },
    { id: 'm-vera', name: 'Véra', color: '#DB2777' },
  ])
}

export function defaultAccounts(): Account[] {
  return stamp<Account>([
    { id: 'a-bt', name: 'Banque de Tahiti', type: 'checking', institution: 'banque-de-tahiti', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '#0E7490' },
    { id: 'a-amex', name: 'American Express', type: 'credit', institution: 'amex', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '#2563EB' },
    { id: 'a-deblock', name: 'Deblock', type: 'checking', institution: 'deblock', currency: 'EUR', initialBalance: 0, fxFeePct: 0, color: '#9333EA' },
    { id: 'a-cash', name: 'Espèces', type: 'cash', institution: 'cash', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '#15803D' },
  ])
}

const E = (id: string, name: string, icon: string, color: string): Seed<Category> => ({ id: `c-${id}`, name, kind: 'expense', icon, color })
const I = (id: string, name: string, icon: string, color: string): Seed<Category> => ({ id: `c-${id}`, name, kind: 'income', icon, color })

export function defaultCategories(): Category[] {
  return stamp<Category>([
    E('logement', 'Logement', 'home', '#475569'),
    E('electricite', 'Électricité', 'zap', '#CA8A04'),
    E('eau', 'Eau', 'droplets', '#0284C7'),
    E('telecom', 'Téléphone & Internet', 'wifi', '#4F46E5'),
    E('courses', 'Courses', 'shopping-cart', '#15803D'),
    E('restaurants', 'Restos & snacks', 'utensils', '#EA580C'),
    E('carburant', 'Carburant', 'fuel', '#B45309'),
    E('voiture', 'Voiture', 'car', '#64748B'),
    E('transport', 'Transports & îles', 'ship', '#0E7490'),
    E('sante', 'Santé', 'heart-pulse', '#DC2626'),
    E('assurances', 'Assurances', 'shield', '#0F766E'),
    E('abonnements', 'Abonnements', 'repeat', '#9333EA'),
    E('loisirs', 'Loisirs & sorties', 'palmtree', '#65A30D'),
    E('shopping', 'Shopping', 'shopping-bag', '#DB2777'),
    E('enfants', 'Enfants & école', 'baby', '#F59E0B'),
    E('maison', 'Maison & jardin', 'sofa', '#78716C'),
    E('voyages', 'Voyages', 'plane', '#2563EB'),
    E('impots', 'Impôts & taxes', 'landmark', '#334155'),
    E('banque', 'Frais bancaires', 'credit-card', '#57534E'),
    E('cadeaux', 'Cadeaux & dons', 'gift', '#BE185D'),
    E('animaux', 'Animaux', 'paw-print', '#A16207'),
    E('divers', 'Divers', 'circle-dashed', '#6B7280'),
    I('salaire', 'Salaire', 'briefcase', '#15803D'),
    I('allocations', 'Allocations (CPS)', 'hand-coins', '#0F766E'),
    I('remboursements', 'Remboursements', 'undo-2', '#0284C7'),
    I('ventes', 'Ventes', 'tag', '#CA8A04'),
    I('autres-revenus', 'Autres revenus', 'plus-circle', '#65A30D'),
  ])
}

/** Commerçants et organismes de Polynésie → catégorie. Modifiables dans Paramètres › Règles. */
const LOCAL_RULES: [string, string][] = [
  ['edt', 'electricite'], ['engie', 'electricite'], ['electricite de tahiti', 'electricite'],
  ['polynesienne des eaux', 'eau'], ['spea', 'eau'], ['eau de tahiti', 'eau'],
  ['vini', 'telecom'], ['viti', 'telecom'], ['ora', 'telecom'], ['vodafone', 'telecom'], ['opt', 'telecom'], ['onati', 'telecom'], ['ina', 'telecom'],
  ['carrefour', 'courses'], ['champion', 'courses'], ['super u', 'courses'], ['hyper u', 'courses'], ['easy market', 'courses'],
  ['leader price', 'courses'], ['tahiti discount', 'courses'], ['cash and carry', 'courses'], ['liaut', 'courses'], ['score', 'courses'],
  ['mcdonald', 'restaurants'], ['mc donald', 'restaurants'], ['mcdo', 'restaurants'], ['roulotte', 'restaurants'], ['snack', 'restaurants'], ['restaurant', 'restaurants'], ['burger king', 'restaurants'],
  ['total', 'carburant'], ['mobil', 'carburant'], ['station', 'carburant'], ['pacific petroleum', 'carburant'],
  ['aremiti', 'transport'], ['terevau', 'transport'], ['air tahiti', 'transport'], ['le truck', 'transport'], ['tere tahiti', 'transport'],
  ['air tahiti nui', 'voyages'], ['french bee', 'voyages'], ['air france', 'voyages'], ['booking', 'voyages'], ['airbnb', 'voyages'],
  ['pharmacie', 'sante'], ['cps', 'sante'], ['clinique', 'sante'], ['chpf', 'sante'], ['paofai', 'sante'], ['cardella', 'sante'], ['laboratoire', 'sante'],
  ['assurance', 'assurances'], ['gan', 'assurances'], ['axa', 'assurances'], ['allianz', 'assurances'],
  ['netflix', 'abonnements'], ['spotify', 'abonnements'], ['disney', 'abonnements'], ['youtube', 'abonnements'], ['google', 'abonnements'],
  ['apple.com', 'abonnements'], ['canal', 'abonnements'], ['dashlane', 'abonnements'], ['playstation', 'abonnements'], ['amazon prime', 'abonnements'],
  ['dgi', 'impots'], ['tresor public', 'impots'], ['contributions', 'impots'], ['paierie', 'impots'],
  ['cotisation', 'banque'], ['frais', 'banque'], ['commission', 'banque'], ['agios', 'banque'],
  ['salaire', 'c-salaire'],
]

export function defaultRules(): Rule[] {
  return stamp<Rule>(
    LOCAL_RULES.map(([pattern, cat], i) => ({
      id: `r-${i}`,
      pattern,
      categoryId: cat.startsWith('c-') ? cat : `c-${cat}`,
    })),
  )
}

/**
 * Abonnements repris des captures de l'app actuelle (montants d'origine en euros,
 * que Paramapp convertissait avec un taux approximatif de 119,26).
 */
export function paramappSubscriptions(): Subscription[] {
  const s = (p: Partial<Subscription> & Pick<Subscription, 'id' | 'name' | 'amount' | 'currency' | 'startDate' | 'color'>): Seed<Subscription> => ({
    every: 1, unit: 'month', status: 'active', tags: [], remindDays: 2, categoryId: 'c-abonnements', member: undefined, ...p,
  })
  return stamp<Subscription>([
    s({ id: 's-disney', name: 'Disney+', plan: 'Standard avec pub', amount: 5.99, currency: 'EUR', startDate: '2026-11-08', color: '#0B5F59', tags: ['Streaming'] }),
    s({ id: 's-navicat', name: 'PremiumSoft Navicat', plan: 'Navicat for MariaDB', amount: 7.99, currency: 'USD', startDate: '2026-11-08', color: '#A68D85', tags: ['Utilitaire'], notes: 'Montant saisi « 7,99 FCFP » dans Paramapp : devise à vérifier.' }),
    s({ id: 's-google-one', name: 'Google One', plan: '2 To', amount: 9.99, currency: 'EUR', startDate: '2026-11-15', color: '#03A9F4', tags: ['Stockage'] }),
    s({ id: 's-youtube', name: 'YouTube Premium', amount: 12.99, currency: 'EUR', startDate: '2026-11-20', color: '#E91E63', tags: ['Streaming'] }),
    s({ id: 's-spotify', name: 'Spotify', plan: 'Premium personnel', amount: 9.99, currency: 'EUR', startDate: '2026-11-26', color: '#388E3C', tags: ['Streaming'] }),
    s({ id: 's-vini', name: 'Vini', plan: 'Abonnement GSM', amount: 3900, currency: 'XPF', startDate: '2026-12-01', color: '#F44336', tags: ['Télécom'], categoryId: 'c-telecom' }),
    s({ id: 's-viti-ora', name: 'Viti Ora', plan: 'Abonnement Internet', amount: 9990, currency: 'XPF', startDate: '2026-12-01', color: '#4CAF50', tags: ['Télécom'], categoryId: 'c-telecom' }),
    s({ id: 's-netflix', name: 'Netflix', plan: 'Offre Premium', amount: 13.99, currency: 'EUR', startDate: '2026-12-04', color: '#E50914', tags: ['Streaming'] }),
    s({ id: 's-dashlane', name: 'Dashlane', plan: 'Premium', amount: 39.99, currency: 'EUR', unit: 'year', startDate: '2027-04-08', color: '#009688', tags: ['Utilitaire'] }),
    s({ id: 's-playstation', name: 'PlayStation Plus', plan: 'Essential', amount: 71.99, currency: 'EUR', unit: 'year', startDate: '2027-11-01', color: '#F44336', tags: ['Jeux'], notes: 'Date de renouvellement approximative : à vérifier.' }),
  ])
}
