import { useEffect, useState } from 'react'
import { Download, Info } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** Bouton d'installation (Android/Chrome) ou, à défaut, explications. Masqué si l'app est déjà installée. */
export function InstallCard() {
  const [, force] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  if (isStandalone()) return null
  const install = async () => {
    if (!deferred) return setHelp(true)
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    force((n) => n + 1)
  }
  return (
    <div className="card stack">
      <button className="btn primary block" onClick={() => void install()}>
        <Download size={18} />Installer l'application
      </button>
      {help && (
        <div className="callout" style={{ fontSize: 14 }}>
          <Info size={18} />
          <span>
            {!deferred && !help ? 'Si le bouton ne fait rien : ouvrez' : 'Ouvrez'} cette page dans <strong>Chrome</strong> (pas dans le navigateur intégré d'une autre application : menu ⋮ › « Ouvrir dans Chrome »),
            puis menu <strong>⋮</strong> › <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong> › Installer.
          </span>
        </div>
      )}
    </div>
  )
}
