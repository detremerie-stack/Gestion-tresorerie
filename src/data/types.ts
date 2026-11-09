import type { Currency, Rates } from '../lib/money'
import type { DateOrder, ISODate, IntervalUnit } from '../lib/dates'

/** Champs communs à tous les enregistrements synchronisés. */
export interface Base {
  id: string
  updatedAt: string
  deleted?: boolean
  createdBy?: string
}

/** Qui est concerné : un membre du foyer ou « commun ». */
export type MemberId = string

export type Institution = 'banque-de-tahiti' | 'socredo' | 'banque-de-polynesie' | 'amex' | 'deblock' | 'cash' | 'other'
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash'

export interface Account extends Base {
  name: string
  type: AccountType
  institution: Institution
  currency: Currency
  initialBalance: number
  initialDate?: ISODate
  /** Frais sur paiements en devise étrangère, en % (ex. 2.5). */
  fxFeePct: number
  color: string
  owner?: MemberId
  archived?: boolean
  /** 4 derniers chiffres des cartes rattachées (reconnaissance des paiements Wallet). */
  cardLast4?: string[]
  /** Membre titulaire de chaque carte (clé = 4 derniers chiffres). */
  cardOwners?: Record<string, MemberId>
  /** Mapping d'import mémorisé pour ce compte. */
  importMapping?: ImportMapping
}

export type CategoryKind = 'expense' | 'income'

export interface Category extends Base {
  name: string
  kind: CategoryKind
  icon: string
  color: string
}

export type TxType = 'expense' | 'income' | 'transfer'

export interface Transaction extends Base {
  date: ISODate
  type: TxType
  /** Montant positif, dans la devise du compte. */
  amount: number
  accountId: string
  /** Virements : compte de destination et montant reçu (dans sa devise). */
  toAccountId?: string
  toAmount?: number
  categoryId?: string
  tags: string[]
  payee?: string
  note?: string
  /** Montant d'origine si payé dans une autre devise que celle du compte. */
  originalAmount?: number
  originalCurrency?: Currency
  member?: MemberId
  subscriptionId?: string
  loanId?: string
  plannedId?: string
  tripId?: string
  /** Justificatifs (photos de tickets, factures) stockés sur l'appareil. */
  attachments?: AttachmentMeta[]
  /** Saisie manuelle rapprochée avec une ligne de relevé importée. */
  reconciledAt?: string
  /** Taux utilisé à la saisie (XPF pour 1 unité de la devise d'origine). */
  rateUsed?: number
  importHash?: string
  /** Libellé brut du relevé importé. */
  rawLabel?: string
}

export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled'

export interface Subscription extends Base {
  name: string
  plan?: string
  amount: number
  currency: Currency
  every: number
  unit: IntervalUnit
  startDate: ISODate
  /** Date de fin d'essai gratuit ; le premier paiement a lieu à cette date. */
  trialEnd?: ISODate
  status: SubscriptionStatus
  accountId?: string
  categoryId?: string
  tags: string[]
  color: string
  member?: MemberId
  url?: string
  notes?: string
  /** Rappel N jours avant le prélèvement. */
  remindDays: number
  /** Dernière échéance enregistrée comme payée (opération créée). */
  lastPaidDate?: ISODate
  cancelledOn?: ISODate
}

export interface Loan extends Base {
  name: string
  lender?: string
  /** Capital emprunté. */
  principal: number
  currency: Currency
  /** Taux nominal annuel en % (hors assurance). */
  annualRate: number
  /** Durée en mois. */
  termMonths: number
  /** Date de la première échéance. */
  startDate: ISODate
  /** Assurance emprunteur par mois (montant fixe). */
  insuranceMonthly: number
  /** Remboursements anticipés partiels : la mensualité reste la même, la durée raccourcit. */
  extraRepayments: { date: ISODate; amount: number }[]
  accountId?: string
  categoryId?: string
  member?: MemberId
  color: string
  notes?: string
  /** Dernière échéance enregistrée comme payée (opération créée). */
  lastPaidDate?: ISODate
}

/** Entrée ou sortie prévue (salaire, pension, impôt, assurance annuelle, rentrée scolaire…). */
export interface Planned extends Base {
  name: string
  kind: 'income' | 'expense'
  amount: number
  currency: Currency
  /** 'once' = une seule fois à startDate. */
  unit: IntervalUnit | 'once'
  every: number
  startDate: ISODate
  endDate?: ISODate
  categoryId?: string
  accountId?: string
  member?: MemberId
  notes?: string
  active: boolean
}

export interface AttachmentMeta {
  id: string
  name: string
  type: string
  size: number
  createdAt: string
}

export interface TripLine {
  id: string
  label: string
  amount: number
  currency: Currency
}

export interface Trip extends Base {
  name: string
  destination?: string
  startDate: ISODate
  endDate: ISODate
  budgetLines: TripLine[]
  /** Compte où l'argent du voyage est mis de côté (ex. Deblock). */
  savingsAccountId?: string
  /** Devise principale sur place et carte utilisée (mode voyage de la saisie rapide). */
  currency?: Currency
  cardAccountId?: string
  color: string
  notes?: string
}

export interface Budget extends Base {
  categoryId: string
  /** Plafond mensuel en XPF. */
  amount: number
}

export interface Rule extends Base {
  /** Texte recherché dans le libellé (insensible à la casse et aux accents). */
  pattern: string
  categoryId?: string
  payee?: string
  tags?: string[]
}

export interface Member extends Base {
  name: string
  color: string
}

export interface ImportMapping {
  delimiter: string
  hasHeader: boolean
  dateCol: number
  labelCol: number
  /** Une colonne montant signée, ou deux colonnes débit/crédit. */
  amountCol?: number
  debitCol?: number
  creditCol?: number
  dateOrder: DateOrder
  /** Inverser le signe (cartes de crédit où les dépenses sont positives, ex. AmEx). */
  invert: boolean
  skipRows: number
}

export interface Settings {
  rates: Rates
  ratesUpdatedAt?: string
  theme: 'system' | 'light' | 'dark'
  /** Identifiant du membre utilisant cet appareil. */
  currentMember?: MemberId
  subscriptionsView: 'month' | 'year'
  /** Nombre d'années affichées (année en cours incluse) ; les plus anciennes passent en archives. */
  visibleYears?: number
  /** Dépenses courantes mensuelles retenues pour le prévisionnel (sinon : moyenne des 3 derniers mois). */
  forecastVariable?: number
}

/** Collections synchronisées (une « kind » par collection). */
export interface Collections {
  accounts: Account
  categories: Category
  transactions: Transaction
  subscriptions: Subscription
  budgets: Budget
  rules: Rule
  members: Member
  loans: Loan
  planned: Planned
  trips: Trip
}
export type Kind = keyof Collections
export const KINDS: Kind[] = ['accounts', 'categories', 'transactions', 'subscriptions', 'budgets', 'rules', 'members', 'loans', 'planned', 'trips']
