import { describe, expect, it, vi } from 'vitest'
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, createStore: () => ({}), keys: async () => [] }))
import { globalShortcut, ignoreShortcut, isTypingTarget, pinKey, quickKey } from './keys'
import { SIDE_FOOT, SIDE_MAIN, SIDE_MORE, TOP_LEVEL, isSideActive } from './Shell'

const el = (tagName: string, extra: object = {}) => ({ tagName, ...extra }) as unknown as EventTarget

describe('raccourcis clavier', () => {
  it('N et / partout, sauf dans un champ, avec Ctrl/Cmd/Alt ou dialogue ouvert', () => {
    expect(globalShortcut({ key: 'n', target: el('BODY') }, false)).toBe('new')
    expect(globalShortcut({ key: 'N', target: el('A') }, false)).toBe('new')
    expect(globalShortcut({ key: '/', target: el('BODY') }, false)).toBe('search')
    expect(globalShortcut({ key: 'n', target: el('INPUT') }, false)).toBeUndefined()
    expect(globalShortcut({ key: 'n', target: el('TEXTAREA') }, false)).toBeUndefined()
    expect(globalShortcut({ key: 'n', target: el('DIV', { isContentEditable: true }) }, false)).toBeUndefined()
    expect(globalShortcut({ key: 'n', ctrlKey: true, target: el('BODY') }, false)).toBeUndefined()
    expect(globalShortcut({ key: 'n', target: el('BODY') }, true)).toBeUndefined()
    expect(globalShortcut({ key: 'x', target: el('BODY') }, false)).toBeUndefined()
    expect(isTypingTarget(null)).toBe(false)
    expect(ignoreShortcut({ key: 'a', metaKey: true }, false)).toBe(true)
  })
  it('saisie rapide : chiffres, virgule, effacer, Entrée, Échap', () => {
    const b = el('BUTTON')
    expect(quickKey({ key: '7', target: b })).toBe('7')
    expect(quickKey({ key: '.', target: b })).toBe(',')
    expect(quickKey({ key: ',', target: b })).toBe(',')
    expect(quickKey({ key: 'Backspace', target: b })).toBe('⌫')
    expect(quickKey({ key: 'Enter', target: b })).toBe('save')
    expect(quickKey({ key: 'Escape', target: b })).toBe('close')
    // Dans le champ « Où ? » : on tape normalement, Entrée enregistre, Échap ferme.
    expect(quickKey({ key: '7', target: el('INPUT') })).toBeUndefined()
    expect(quickKey({ key: 'Backspace', target: el('INPUT') })).toBeUndefined()
    expect(quickKey({ key: 'Enter', target: el('INPUT') })).toBe('save')
    expect(quickKey({ key: 'Escape', target: el('INPUT') })).toBe('close')
    expect(quickKey({ key: '7', ctrlKey: true, target: b })).toBeUndefined()
    expect(quickKey({ key: 'a', target: b })).toBeUndefined()
  })
  it('verrou : chiffres et effacer', () => {
    expect(pinKey({ key: '4' })).toBe('4')
    expect(pinKey({ key: 'Backspace' })).toBe('⌫')
    expect(pinKey({ key: 'Enter' })).toBeUndefined()
  })
})

describe('barre latérale', () => {
  it('ordre exact des 13 entrées', () => {
    expect([...SIDE_MAIN, ...SIDE_MORE, ...SIDE_FOOT].map((e) => e.label)).toEqual([
      'Accueil', 'Historique', 'Abonnements', 'Les mois à venir', 'Où part notre argent', 'Importer un relevé',
      'Voyages', 'Crédits', 'Comptes', 'Limites de dépenses', 'Tickets et factures', 'Réglages', 'Partage',
    ])
    expect(TOP_LEVEL).toHaveLength(13)
  })
  it('entrée active : écran et sous-pages ; Partage distinct de Réglages', () => {
    expect(isSideActive('/', '/')).toBe(true)
    expect(isSideActive('/', '/operations')).toBe(false)
    expect(isSideActive('/operations', '/operations/t-1')).toBe(true)
    expect(isSideActive('/parametres', '/parametres/categories')).toBe(true)
    expect(isSideActive('/parametres', '/parametres/synchro')).toBe(false)
    expect(isSideActive('/parametres/synchro', '/parametres/synchro')).toBe(true)
    expect(isSideActive('/prets', '/previsionnel')).toBe(false)
  })
})
