/** Raccourcis clavier : garde commune (spécification 21 § 5). */

interface KeyLike {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  target?: EventTarget | null
}

/** La cible est-elle un champ où l'on tape du texte ? */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean; closest?: (s: string) => unknown } | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable
}

/** Un raccourci global est ignoré avec Ctrl/Cmd/Alt, dans un champ, ou quand une boîte de dialogue est ouverte. */
export function ignoreShortcut(e: KeyLike, dialogOpen: boolean): boolean {
  return !!(e.ctrlKey || e.metaKey || e.altKey) || isTypingTarget(e.target) || dialogOpen
}

/** Action d'un raccourci global (hors saisie rapide et verrou). */
export function globalShortcut(e: KeyLike, dialogOpen: boolean): 'new' | 'search' | undefined {
  if (ignoreShortcut(e, dialogOpen)) return undefined
  if (e.key === 'n' || e.key === 'N') return 'new'
  if (e.key === '/') return 'search'
  return undefined
}

/** Touche du pavé de la saisie rapide : chiffre, virgule, effacer, enregistrer, fermer. */
export function quickKey(e: KeyLike): string | 'save' | 'close' | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined
  if (e.key === 'Escape') return 'close'
  if (isTypingTarget(e.target)) return e.key === 'Enter' ? 'save' : undefined
  if (/^[0-9]$/.test(e.key)) return e.key
  if (e.key === ',' || e.key === '.') return ','
  if (e.key === 'Backspace') return '⌫'
  if (e.key === 'Enter') return 'save'
  return undefined
}

/** Touche du verrou : chiffre ou effacer. */
export function pinKey(e: KeyLike): string | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined
  if (/^[0-9]$/.test(e.key)) return e.key
  if (e.key === 'Backspace') return '⌫'
  return undefined
}
