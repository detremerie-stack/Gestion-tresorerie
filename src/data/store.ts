import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { useMemo } from 'react'
import type { Collections, Kind, Settings, Subscription, Transaction } from './types'
import { KINDS } from './types'
import { defaultAccounts, defaultCategories, defaultMembers, defaultRules, paramappSubscriptions } from './defaults'
import { uid } from '../lib/id'
import { DEFAULT_RATES, fromXPF, toXPF } from '../lib/money'

type Maps = { [K in Kind]: Record<string, Collections[K]> }

export interface SyncConfig {
  url?: string
  anonKey?: string
  householdId?: string
  householdName?: string
  inviteCode?: string
  lastPulledAt?: string
}

export interface State {
  data: Maps
  settings: Settings
  /** Enregistrements modifiés localement, à envoyer au serveur (`kind:id`). */
  dirty: Record<string, true>
  sync: SyncConfig
  onboarded: boolean

  upsert: <K extends Kind>(kind: K, rec: Partial<Collections[K]> & { id?: string }) => Collections[K]
  upsertMany: <K extends Kind>(kind: K, recs: Collections[K][]) => void
  remove: (kind: Kind, id: string) => void
  /** Applique des enregistrements venant du serveur (sans les marquer modifiés). */
  applyRemote: (rows: { kind: Kind; data: Collections[Kind] }[]) => void
  clearDirty: (keys: string[]) => void
  setSettings: (p: Partial<Settings>) => void
  setSync: (p: Partial<SyncConfig>) => void
  completeOnboarding: (opts: { member: string; importParamapp: boolean }) => void
  markSubscriptionPaid: (sub: Subscription, date: string, amountInAccount?: number) => Transaction
  replaceAll: (data: Partial<Maps>) => void
}

const emptyMaps = (): Maps => Object.fromEntries(KINDS.map((k) => [k, {}])) as unknown as Maps

const toMap = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))

const idbStorage: StateStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
}

export const useStore = create<State>()(
  persist(
    (setState, getState) => ({
      data: emptyMaps(),
      settings: { rates: DEFAULT_RATES, theme: 'system', subscriptionsView: 'month' },
      dirty: {},
      sync: {},
      onboarded: false,

      upsert: (kind, rec) => {
        const id = rec.id ?? uid()
        const prev = getState().data[kind][id]
        const next = {
          ...(prev ?? {}),
          ...rec,
          id,
          updatedAt: new Date().toISOString(),
          createdBy: prev?.createdBy ?? rec.createdBy ?? getState().settings.currentMember,
        } as Collections[typeof kind]
        setState((s) => ({
          data: { ...s.data, [kind]: { ...s.data[kind], [id]: next } },
          dirty: { ...s.dirty, [`${kind}:${id}`]: true },
        }))
        return next
      },

      upsertMany: (kind, recs) => {
        if (!recs.length) return
        const stamp = new Date().toISOString()
        setState((s) => {
          const map: Record<string, Collections[typeof kind]> = { ...s.data[kind] }
          const dirty = { ...s.dirty }
          for (const r of recs) {
            map[r.id] = { ...r, updatedAt: stamp, createdBy: r.createdBy ?? s.settings.currentMember }
            dirty[`${kind}:${r.id}`] = true
          }
          return { data: { ...s.data, [kind]: map }, dirty }
        })
      },

      remove: (kind, id) => {
        const prev = getState().data[kind][id]
        if (!prev) return
        getState().upsert(kind, { ...prev, deleted: true })
      },

      applyRemote: (rows) => {
        if (!rows.length) return
        setState((s) => {
          const data = { ...s.data }
          const touched = new Set<Kind>()
          for (const { kind, data: rec } of rows) {
            if (!KINDS.includes(kind)) continue
            // Une modification locale non encore envoyée l'emporte (elle sera poussée ensuite).
            if (s.dirty[`${kind}:${rec.id}`]) continue
            if (!touched.has(kind)) {
              data[kind] = { ...data[kind] } as never
              touched.add(kind)
            }
            ;(data[kind] as Record<string, unknown>)[rec.id] = rec
          }
          return { data }
        })
      },

      clearDirty: (keys) =>
        setState((s) => {
          const dirty = { ...s.dirty }
          for (const k of keys) delete dirty[k]
          return { dirty }
        }),

      setSettings: (p) => setState((s) => ({ settings: { ...s.settings, ...p } })),
      setSync: (p) => setState((s) => ({ sync: { ...s.sync, ...p } })),

      completeOnboarding: ({ member, importParamapp }) => {
        const s = getState()
        const isEmpty = (k: Kind) => Object.keys(s.data[k]).length === 0
        if (isEmpty('members')) s.upsertMany('members', defaultMembers())
        if (isEmpty('accounts')) s.upsertMany('accounts', defaultAccounts())
        if (isEmpty('categories')) s.upsertMany('categories', defaultCategories())
        if (isEmpty('rules')) s.upsertMany('rules', defaultRules())
        if (importParamapp && isEmpty('subscriptions')) {
          s.upsertMany('subscriptions', paramappSubscriptions().map((x) => ({ ...x, accountId: x.currency === 'XPF' ? 'a-bt' : 'a-amex' })))
        }
        setState((st) => ({ onboarded: true, settings: { ...st.settings, currentMember: member } }))
      },

      markSubscriptionPaid: (sub, date, amountInAccount) => {
        const s = getState()
        const account = sub.accountId ? s.data.accounts[sub.accountId] : undefined
        const foreign = !!account && account.currency !== sub.currency
        const converted = foreign
          ? fromXPF(toXPF(sub.amount, sub.currency, s.settings.rates) * (1 + (sub.currency === 'XPF' ? 0 : account!.fxFeePct) / 100), account!.currency, s.settings.rates)
          : sub.amount
        const tx = s.upsert('transactions', {
          date,
          type: 'expense',
          amount: amountInAccount ?? converted,
          accountId: sub.accountId ?? Object.values(s.data.accounts).find((a) => !a.deleted)?.id ?? '',
          categoryId: sub.categoryId,
          tags: sub.tags,
          payee: sub.name,
          note: sub.plan,
          member: sub.member,
          subscriptionId: sub.id,
          ...(foreign ? { originalAmount: sub.amount, originalCurrency: sub.currency } : {}),
        })
        if (!sub.lastPaidDate || date > sub.lastPaidDate) {
          s.upsert('subscriptions', { ...sub, lastPaidDate: date, status: sub.status === 'trial' ? 'active' : sub.status })
        }
        return tx
      },

      replaceAll: (data) =>
        setState((s) => {
          const next = { ...s.data }
          const dirty = { ...s.dirty }
          for (const k of KINDS) {
            const recs = (data[k] ?? {}) as Record<string, { id: string }>
            if (!data[k]) continue
            next[k] = recs as never
            for (const id of Object.keys(recs)) dirty[`${k}:${id}`] = true
          }
          return { data: next, dirty }
        }),
    }),
    {
      name: 'moni-store',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ data: s.data, settings: s.settings, dirty: s.dirty, sync: s.sync, onboarded: s.onboarded }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return { ...current, ...p, data: { ...emptyMaps(), ...(p.data ?? {}) }, settings: { ...current.settings, ...(p.settings ?? {}) } }
      },
    },
  ),
)

/** Liste des enregistrements non supprimés d'une collection (référence stable). */
export function useList<K extends Kind>(kind: K): Collections[K][] {
  const map = useStore((s) => s.data[kind])
  return useMemo(() => Object.values(map).filter((x) => !x.deleted), [map]) as Collections[K][]
}

export function useMap<K extends Kind>(kind: K): Map<string, Collections[K]> {
  const map = useStore((s) => s.data[kind])
  return useMemo(() => new Map(Object.entries(map)), [map]) as Map<string, Collections[K]>
}

export const useRates = () => useStore((s) => s.settings.rates)

export { toMap }
