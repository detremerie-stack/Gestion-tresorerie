/**
 * Verrouillage local de l'app (propre à chaque téléphone, non synchronisé).
 * Protège l'accès à l'écran ; ce n'est pas un chiffrement des données.
 */
const KEY = 'fare-moni-lock'
interface LockConfig { salt: string; hash: string; credentialId?: string }

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function hashPin(pin: string, salt: string): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))
}

export function lockConfig(): LockConfig | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
export const isLockEnabled = () => !!lockConfig()

export async function setPin(pin: string) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await hashPin(pin, salt) }))
}
export async function checkPin(pin: string): Promise<boolean> {
  const c = lockConfig()
  return !!c && (await hashPin(pin, c.salt)) === c.hash
}
export function disableLock() {
  localStorage.removeItem(KEY)
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}
export const hasBiometric = () => !!lockConfig()?.credentialId

/** Enregistre l'empreinte / le visage du téléphone comme moyen de déverrouillage. */
export async function enableBiometric(): Promise<boolean> {
  const c = lockConfig()
  if (!c) return false
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Fare Moni' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'fare-moni', displayName: 'Fare Moni' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return false
    localStorage.setItem(KEY, JSON.stringify({ ...c, credentialId: b64(cred.rawId) }))
    return true
  } catch {
    return false
  }
}
export function disableBiometric() {
  const c = lockConfig()
  if (c) localStorage.setItem(KEY, JSON.stringify({ salt: c.salt, hash: c.hash }))
}
export async function unlockWithBiometric(): Promise<boolean> {
  const c = lockConfig()
  if (!c?.credentialId) return false
  try {
    const res = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(c.credentialId) }], userVerification: 'required', timeout: 60000 },
    })
    return !!res
  } catch {
    return false
  }
}

/* ---------- Délai après erreurs (P5) : un frein, pas une protection forte ---------- */
const TRIES = 'fare-moni-lock-essais'

/** Attente imposée (secondes) après `failures` codes faux de suite : rien avant 5, puis 30 s, 1 min, 2 min, 5 min. */
export function lockDelay(failures: number): number {
  if (failures < 5) return 0
  return [30, 60, 120][failures - 5] ?? 300
}
export function lockTries(): { failures: number; until: number } {
  try {
    const t = JSON.parse(localStorage.getItem(TRIES) ?? 'null') as { failures?: number; until?: number } | null
    return { failures: t?.failures ?? 0, until: t?.until ?? 0 }
  } catch {
    return { failures: 0, until: 0 }
  }
}
/** Note un code faux ; renvoie l'heure (ms) avant laquelle il faut attendre (0 si aucune attente). */
export function recordFailure(now = Date.now()): number {
  const failures = lockTries().failures + 1
  const d = lockDelay(failures)
  const until = d ? now + d * 1000 : 0
  localStorage.setItem(TRIES, JSON.stringify({ failures, until }))
  return until
}
export function resetFailures() {
  localStorage.removeItem(TRIES)
}
