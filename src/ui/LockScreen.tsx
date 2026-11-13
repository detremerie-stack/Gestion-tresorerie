import { useEffect, useRef, useState } from 'react'
import { pinKey } from './keys'
import { Delete, Fingerprint } from 'lucide-react'
import { checkPin, hasBiometric, isLockEnabled, lockTries, recordFailure, resetFailures, unlockWithBiometric } from '../lib/lock'

/** Pavé de saisie d'un code à 4 chiffres. */
export function PinPad({ title, subtitle, error, onComplete, extra, disabled }: { title: string; subtitle?: string; error?: string; onComplete: (pin: string) => void; extra?: React.ReactNode; disabled?: boolean }) {
  const [pin, setPin] = useState('')
  useEffect(() => { if (error) setPin('') }, [error])
  const press = (k: string) => {
    if (disabled) return
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    if (pin.length >= 4) return
    const next = pin + k
    setPin(next)
    if (next.length === 4) setTimeout(() => { onComplete(next); setPin('') }, 120)
  }
  // Clavier (PC) : chiffres et Retour arrière.
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = pinKey(e)
      if (!k) return
      e.preventDefault()
      pressRef.current(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="lock">
      <img src="./icon.svg" alt="" width={64} height={64} style={{ borderRadius: 16 }} />
      <h1>{title}</h1>
      <p className={error ? 'error' : ''} role={error ? 'alert' : undefined}>{error ?? subtitle ?? ' '}</p>
      <div className="lock-dots" aria-label={`${pin.length} chiffre(s) saisi(s) sur 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      <div className="keypad lock-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" disabled={disabled} onClick={() => press(k)}>{k}</button>)}
        <span>{extra}</span>
        <button type="button" disabled={disabled} onClick={() => press('0')}>0</button>
        <button type="button" aria-label="Effacer" onClick={() => press('⌫')}><Delete size={22} /></button>
      </div>
    </div>
  )
}

/** Verrouille l'app au lancement et après 2 minutes en arrière-plan. */
export function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(isLockEnabled())
  const [error, setError] = useState<string>()
  useEffect(() => {
    let hiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 120_000 && isLockEnabled()) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  // Délai croissant après 5 codes faux (P5), conservé même si l'on recharge la page.
  const [until, setUntil] = useState(() => lockTries().until)
  const [now, setNow] = useState(() => Date.now())
  const waiting = until > now
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [waiting])
  const bio = async () => { if (await unlockWithBiometric()) { resetFailures(); setLocked(false) } }
  useEffect(() => { if (locked && hasBiometric()) void bio() }, [locked])
  if (!locked) return <>{children}</>
  return (
    <div className="lock-gate">
    <PinPad title="Fare Moni" subtitle="Entrez votre code" disabled={waiting}
      error={waiting ? `Trop d'essais. Réessayez dans ${Math.ceil((until - now) / 1000)} s.` : error}
      onComplete={async (pin) => {
        if (await checkPin(pin)) { resetFailures(); setError(undefined); setLocked(false); return }
        const u = recordFailure()
        setUntil(u); setNow(Date.now())
        setError('Code incorrect')
      }}
      extra={hasBiometric() ? <button type="button" aria-label="Déverrouiller avec l'empreinte" onClick={() => void bio()}><Fingerprint size={24} /></button> : null} />
    </div>
  )
}
