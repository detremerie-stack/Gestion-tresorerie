import { readFileSync, existsSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// IndexedDB n'existe pas sous Node : stockage en mémoire à la place d'idb-keyval.
const mem = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: async (k: string) => mem.get(k),
  set: async (k: string, v: unknown) => { mem.set(k, v) },
  del: async (k: string) => { mem.delete(k) },
  createStore: () => ({}),
  keys: async () => [...mem.keys()],
}))

import { STORE_VERSION, mergePersisted, migratePersisted, useStore, type State } from './store'
import { KINDS, type Kind, type Loan, type Subscription } from './types'
import { defaultCategories, defaultRules } from './defaults'
import { mergeBackup, parseBackup } from '../lib/backup'
import { accountBalance } from '../lib/reports'
import { installmentsBetween } from '../lib/loans'
import fixture from '../test/fixture-sauvegarde.json'

const initial = useStore.getState()
const reset = () => useStore.setState({ ...initial, data: Object.fromEntries(KINDS.map((k) => [k, {}])) as State['data'], dirty: {}, sync: {}, onboarded: false }, true)
beforeEach(() => { mem.clear(); reset() })

type Maps = State['data']
const counts = (d: Partial<Maps>) => Object.fromEntries(KINDS.map((k) => [k, Object.keys(d[k] ?? {}).length]))
const balances = (d: Maps) => {
  const txs = Object.values(d.transactions)
  return Object.fromEntries(Object.values(d.accounts).map((a) => [a.id, accountBalance(a, txs)]))
}

describe('état enregistré', () => {
  it('garde la version 1 et migre à l’identique', () => {
    expect(STORE_VERSION).toBe(1)
    const p = { data: { accounts: { a: { id: 'a' } } }, onboarded: true }
    expect(migratePersisted(p, 0)).toBe(p)
  })

  it('merge : complète les collections et les réglages sans rien perdre', () => {
    const persisted = { data: { transactions: { t1: { id: 't1', amount: 5 } } }, settings: { theme: 'dark' }, onboarded: true, dirty: { 'transactions:t1': true } }
    const s = mergePersisted(persisted, initial)
    for (const k of KINDS) expect(s.data[k]).toBeDefined()
    expect(s.data.transactions.t1).toEqual({ id: 't1', amount: 5 })
    expect(s.settings.theme).toBe('dark')
    expect(s.settings.rates).toEqual(initial.settings.rates)
    expect(s.settings.subscriptionsView).toBe('month')
    expect(s.onboarded).toBe(true)
    expect(s.dirty).toEqual({ 'transactions:t1': true })
    expect(typeof s.upsert).toBe('function')
  })

  it('relit une ancienne version enregistrée sans effacer les données', async () => {
    const stored = { state: { data: { members: { m1: { id: 'm1', name: 'A', color: '#000', updatedAt: '' } } }, onboarded: true, settings: {}, dirty: {}, sync: {} }, version: 0 }
    mem.set('moni-store', JSON.stringify(stored))
    await useStore.persist.rehydrate()
    expect(useStore.getState().data.members.m1?.name).toBe('A')
    expect(useStore.getState().onboarded).toBe(true)
  })
})

describe('actions du store', () => {
  it('replaceAll remplace les collections fournies, les marque à envoyer et laisse les autres', () => {
    const st = useStore.getState()
    st.upsert('members', { id: 'm1', name: 'A', color: '#000' })
    useStore.getState().clearDirty(['members:m1'])
    useStore.getState().replaceAll({ accounts: { a1: { id: 'a1' } as never } })
    const s = useStore.getState()
    expect(Object.keys(s.data.accounts)).toEqual(['a1'])
    expect(s.data.members.m1.name).toBe('A')
    expect(s.dirty).toEqual({ 'accounts:a1': true })
  })

  it('applyRemote ne remplace pas une modification locale non envoyée', () => {
    useStore.getState().upsert('members', { id: 'm1', name: 'Local', color: '#000' })
    useStore.getState().applyRemote([
      { kind: 'members', data: { id: 'm1', name: 'Distant', color: '#111', updatedAt: '' } },
      { kind: 'members', data: { id: 'm2', name: 'Nouveau', color: '#111', updatedAt: '' } },
    ])
    const m = useStore.getState().data.members
    expect(m.m1.name).toBe('Local')
    expect(m.m2.name).toBe('Nouveau')
    expect(useStore.getState().dirty['members:m2']).toBeUndefined()
  })

  it('applyRemote ignore les enregistrements distants mal formés (P10)', () => {
    useStore.getState().applyRemote([
      { kind: 'transactions', data: { id: 't-ok', amount: 5 } as never },
      { kind: 'transactions', data: { id: 't-nan', amount: null } as never },
      { kind: 'transactions', data: { amount: 5 } as never },
      { kind: 'hack' as Kind, data: { id: 'x' } as never },
    ])
    expect(Object.keys(useStore.getState().data.transactions)).toEqual(['t-ok'])
    expect((useStore.getState().data as Record<string, unknown>).hack).toBeUndefined()
  })

  it('markSubscriptionPaid : même devise, devise étrangère avec frais, essai → actif', () => {
    const st = useStore.getState()
    st.upsertMany('accounts', [
      { id: 'xpf', updatedAt: '', name: 'C', type: 'checking', institution: 'other', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '' },
      { id: 'eur', updatedAt: '', name: 'Amex', type: 'credit', institution: 'amex', currency: 'EUR', initialBalance: 0, fxFeePct: 2.8, color: '' },
    ])
    const sub: Subscription = { id: 's1', updatedAt: '', name: 'Abo', amount: 1500, currency: 'XPF', every: 1, unit: 'month', startDate: '2026-01-09', status: 'trial', accountId: 'xpf', tags: ['x'], color: '', remindDays: 2 }
    useStore.getState().upsert('subscriptions', sub)
    const tx = useStore.getState().markSubscriptionPaid(sub, '2026-11-09')
    expect(tx).toMatchObject({ amount: 1500, accountId: 'xpf', type: 'expense', subscriptionId: 's1', payee: 'Abo', date: '2026-11-09' })
    expect(tx.originalCurrency).toBeUndefined()
    expect(useStore.getState().data.subscriptions.s1).toMatchObject({ lastPaidDate: '2026-11-09', status: 'active' })
    // Paiement plus ancien : la dernière échéance payée ne recule pas.
    useStore.getState().markSubscriptionPaid(useStore.getState().data.subscriptions.s1, '2026-10-09')
    expect(useStore.getState().data.subscriptions.s1.lastPaidDate).toBe('2026-11-09')

    const usd: Subscription = { ...sub, id: 's2', amount: 10, currency: 'USD', accountId: 'eur', status: 'active' }
    const tx2 = useStore.getState().markSubscriptionPaid(usd, '2026-11-17')
    // 10 USD × 110 = 1100 F, + 2,8 % = 1130,8 F → en euros à parité fixe
    expect(tx2.amount).toBeCloseTo(1130.8 / (1000 / 8.38), 2)
    expect(tx2).toMatchObject({ originalAmount: 10, originalCurrency: 'USD', accountId: 'eur' })
    // Montant réellement débité saisi par l'utilisateur : prioritaire
    expect(useStore.getState().markSubscriptionPaid(usd, '2026-12-17', 9.5).amount).toBe(9.5)
  })

  it('markLoanPaid crée l’opération, la catégorie Crédits si besoin, et avance la dernière échéance', () => {
    useStore.getState().upsertMany('accounts', [{ id: 'xpf', updatedAt: '', name: 'C', type: 'checking', institution: 'other', currency: 'XPF', initialBalance: 0, fxFeePct: 0, color: '' }])
    const loan: Loan = { id: 'l1', updatedAt: '', name: 'Voiture', lender: 'Banque', principal: 1200000, currency: 'XPF', annualRate: 0, termMonths: 12, startDate: '2026-01-05', insuranceMonthly: 0, extraRepayments: [], accountId: 'xpf', color: '' }
    useStore.getState().upsert('loans', loan)
    const inst = installmentsBetween(loan, '2026-03-01', '2026-03-31')[0]
    const tx = useStore.getState().markLoanPaid(loan, inst)
    expect(tx).toMatchObject({ amount: 100000, accountId: 'xpf', loanId: 'l1', categoryId: 'c-credits', date: '2026-03-05', payee: 'Banque' })
    expect(useStore.getState().data.categories['c-credits']?.deleted).toBe(false)
    expect(useStore.getState().data.loans.l1.lastPaidDate).toBe('2026-03-05')
  })

  it('upgradeDefaults ajoute seulement ce qui manque et ne touche à rien d’existant', () => {
    useStore.getState().upgradeDefaults()
    expect(Object.keys(useStore.getState().data.rules)).toHaveLength(0) // pas encore démarré : rien
    useStore.setState({ onboarded: true })
    const cat = defaultCategories()[0]
    const st = useStore.getState()
    st.upsert('categories', { ...cat, name: 'Renommée', color: '#123456' })
    st.upsert('rules', { id: 'r-perso', pattern: defaultRules()[0].pattern.toUpperCase(), categoryId: 'c-perso' })
    const sub: Subscription = { id: 's-netflix', updatedAt: '', name: 'Mon abonnement', amount: 1, currency: 'EUR', every: 1, unit: 'month', startDate: '2026-01-01', status: 'active', tags: [], color: '', remindDays: 0 }
    st.upsert('subscriptions', sub)
    st.upsert('subscriptions', { ...sub, id: 's-autre', deleted: true })
    const subsBefore = structuredClone(useStore.getState().data.subscriptions)
    useStore.getState().upgradeDefaults()
    useStore.getState().upgradeDefaults() // idempotent
    const s = useStore.getState()
    expect(s.data.categories[cat.id]).toMatchObject({ name: 'Renommée', color: '#123456' })
    expect(Object.keys(s.data.categories)).toHaveLength(defaultCategories().length)
    // Règle existante (même motif, autre casse) : pas de doublon ; les autres règles par défaut sont ajoutées.
    expect(Object.keys(s.data.rules)).toHaveLength(new Set(defaultRules().map((r) => r.id)).size)
    expect(s.data.rules['r-perso'].categoryId).toBe('c-perso')
    // Les abonnements déjà enregistrés ne sont jamais supprimés ni modifiés.
    expect(s.data.subscriptions).toEqual(subsBefore)
  })
})

describe('premier lancement', () => {
  it('ne crée plus aucun abonnement par défaut, et garde ceux déjà présents', () => {
    useStore.getState().completeOnboarding({ member: 'm-lionel', importParamapp: true })
    const s = useStore.getState()
    expect(Object.keys(s.data.subscriptions)).toHaveLength(0)
    expect(Object.keys(s.data.accounts).length).toBeGreaterThan(0)
    expect(s.onboarded).toBe(true)
    reset()
    const sub: Subscription = { id: 's-x', updatedAt: '', name: 'Déjà là', amount: 1, currency: 'XPF', every: 1, unit: 'month', startDate: '2026-01-01', status: 'active', tags: [], color: '', remindDays: 0 }
    useStore.getState().upsert('subscriptions', sub)
    useStore.getState().completeOnboarding({ member: 'm-lionel' })
    expect(useStore.getState().data.subscriptions['s-x']?.name).toBe('Déjà là')
  })
})

describe('restauration d’une sauvegarde', () => {
  const restore = (json: unknown) => {
    const b = parseBackup(json)
    useStore.getState().replaceAll(mergeBackup(useStore.getState().data, b.data))
    return b
  }

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => parseBackup({ app: 'autre', data: {} })).toThrow(/sauvegarde/)
    expect(() => parseBackup(null)).toThrow()
  })

  it('fixture synthétique : mêmes nombres d’éléments et mêmes soldes', () => {
    const b = restore(fixture)
    const d = useStore.getState().data
    expect(counts(d)).toEqual(counts(fixture.data as unknown as Maps))
    expect(b.total).toBe(KINDS.reduce((s, k) => s + Object.keys((fixture.data as Record<string, object>)[k] ?? {}).length, 0))
    // Soldes relevés sur l'application v1 (écran Comptes, même fixture).
    expect(balances(d)).toEqual({ 'a-bt': 688800, 'a-amex': -102, 'a-deblock': 1776, 'a-cash': -13000 })
    // Rien n'est modifié dans les enregistrements eux-mêmes.
    for (const k of KINDS) for (const [id, rec] of Object.entries((fixture.data as Record<string, Record<string, unknown>>)[k] ?? {})) expect(d[k as Kind][id]).toEqual(rec)
  })

  it('fusion : garde les éléments de l’appareil absents de la sauvegarde', () => {
    useStore.getState().upsert('members', { id: 'm-local', name: 'Local', color: '#000' })
    restore(fixture)
    expect(useStore.getState().data.members['m-local']?.name).toBe('Local')
  })

  it('export puis restauration sur un appareil neuf : identique', () => {
    restore(fixture)
    const exported = JSON.parse(JSON.stringify({ app: 'moni', version: 1, data: useStore.getState().data }))
    const before = structuredClone(useStore.getState().data)
    reset()
    restore(exported)
    expect(useStore.getState().data).toEqual(before)
  })

  // Vraies données : seulement si un chemin est fourni (jamais copiées dans le dépôt).
  const real = process.env.FARE_MONI_SAUVEGARDE
  it.skipIf(!real || !existsSync(real))('sauvegarde réelle (FARE_MONI_SAUVEGARDE) : mêmes nombres et mêmes soldes', () => {
    const json = JSON.parse(readFileSync(real!, 'utf8')) as { data: Partial<Maps> }
    restore(json)
    const d = useStore.getState().data
    expect(counts(d)).toEqual(counts(json.data))
    const expected: Partial<Maps> = { ...json.data }
    const full = Object.fromEntries(KINDS.map((k) => [k, expected[k] ?? {}])) as Maps
    expect(balances(d)).toEqual(balances(full))
  })
})
