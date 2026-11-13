import { describe, expect, it, vi } from 'vitest'
// Rendu serveur : React lirait l'état « initial » du store (vide) ; on lui fait lire l'état réel chargé.
vi.mock('react', async (importOriginal) => {
  const R = await importOriginal<typeof import('react')>()
  const useSyncExternalStore = <T,>(sub: (cb: () => void) => () => void, get: () => T) => R.useSyncExternalStore(sub, get, get)
  return { ...R, useSyncExternalStore, default: { ...R, useSyncExternalStore } }
})
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, createStore: () => ({}), keys: async () => [] }))
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import fixture from '../test/fixture-sauvegarde.json'
import { useStore } from '../data/store'
import { mergeBackup, parseBackup } from '../lib/backup'
import Dashboard from './Dashboard'
import Forecast from './Forecast'

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-11-13T12:00:00'))

const text = (el: React.ReactElement) => renderToString(<MemoryRouter>{el}</MemoryRouter>).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
/** Montant qui suit le libellé « Il restera fin novembre ». */
const after = (t: string) => t.match(/Il restera fin novembre\s+([≈ ]*[−\d  ]+ F)/)?.[1]?.replace(/\s/g, ' ').trim()

describe('décision § 2.1 — un seul « Il restera fin {mois} »', () => {
  useStore.setState({ onboarded: true })
  useStore.getState().replaceAll(mergeBackup(useStore.getState().data, parseBackup(fixture).data))

  it('l’accueil et « Les mois à venir » affichent le même nombre, celui de la v1', () => {
    const home = after(text(<Dashboard />))
    const forecast = after(text(<Forecast />))
    expect(home).toBeDefined()
    expect(forecast).toBe(home)
    expect(home).toMatch(/^1 191 971 F$/)
  })

  it('le second chiffre ne s’appelle jamais « fin {mois} » tout seul', () => {
    const f = text(<Forecast />)
    expect(f).toMatch(/Si vous dépensez comme d'habitude d'ici là \(environ 56 634 F\) : ≈ 1 135 337 F/)
    // Toute autre « fin … » est suivie de « si vous dépensez comme d'habitude ».
    for (const m of f.matchAll(/\b[Ff]in (?!de chaque|de mois)(\S+(?: \d{2,4})?)(.{0,40})/g)) {
      if (m[0].startsWith('fin novembre') && f.includes(`Il restera ${m[0].slice(0, 12)}`)) continue
      expect(m[2]).toMatch(/^ ?,? ?si vous dépensez comme d'habitude/)
    }
    const h = text(<Dashboard />)
    expect(h).toMatch(/une fois payé ce qui est prévu \(abonnements, crédits, factures\)/)
  })
})
