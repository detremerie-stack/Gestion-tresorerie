import { createStore, del, get, keys, set } from 'idb-keyval'
import type { AttachmentMeta } from '../data/types'
import { uid } from './id'

/** Types de justificatifs affichables. Tout autre type (HTML, SVG, script…) est traité comme un fichier opaque. */
export const SAFE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const

/** Type MIME sûr : seulement la liste blanche, sinon `application/octet-stream` (jamais exécuté par le navigateur). */
export function safeType(type: string | undefined | null): string {
  const t = String(type ?? '').split(';')[0].trim().toLowerCase()
  return (SAFE_TYPES as readonly string[]).includes(t) ? t : 'application/octet-stream'
}

/** Copie du fichier avec un type sûr (un justificatif reçu d'ailleurs ne doit pas s'ouvrir comme une page web). */
export function withSafeType(blob: Blob): Blob {
  const t = safeType(blob.type)
  return t === blob.type ? blob : new Blob([blob], { type: t })
}

// Fichiers sur l'appareil (IndexedDB) ; copiés dans Firestore (foyer) quand la synchro est active.
const store = createStore('fare-moni-docs', 'files')
const pending = createStore('fare-moni-docs-pending', 'uploads')

/** Envoie les justificatifs en attente (appelé après chaque synchronisation). */
export async function flushUploads(): Promise<void> {
  const { uploadFile } = await import('../data/sync')
  for (const id of (await keys(pending)) as string[]) {
    const blob = await get<Blob>(id, store)
    if (!blob) { await del(id, pending); continue }
    if (await uploadFile(id, blob, id)) await del(id, pending)
    else if (blob.size > 900_000) await del(id, pending) // trop gros : reste sur ce téléphone
  }
}

/** Réduit une photo à 1600 px de large max en JPEG (un ticket pèse ~200 Ko au lieu de 4 Mo). */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82))
}

export async function saveAttachment(file: File): Promise<AttachmentMeta> {
  const blob = await compress(file)
  const safe = withSafeType(blob.type ? blob : new Blob([blob], { type: file.type }))
  const meta: AttachmentMeta = { id: uid(), name: file.name || 'ticket.jpg', type: safe.type, size: safe.size, createdAt: new Date().toISOString() }
  await set(meta.id, safe, store)
  await set(meta.id, true, pending)
  void flushUploads().catch(() => {})
  return meta
}

export async function attachmentUrl(id: string): Promise<string | undefined> {
  let blob = await get<Blob>(id, store)
  if (!blob) {
    // Justificatif ajouté sur l'autre téléphone : téléchargé puis gardé en cache.
    const { downloadFile } = await import('../data/sync')
    const dl = await downloadFile(id).catch(() => null)
    if (dl) { blob = dl; await set(id, blob, store) }
  }
  return blob ? URL.createObjectURL(withSafeType(blob)) : undefined
}

export async function deleteAttachment(id: string) {
  await del(id, store)
  await del(id, pending)
  const { removeFile } = await import('../data/sync')
  await removeFile(id)
}

/** OCR du ticket dans le navigateur (Tesseract, chargé à la demande ; nécessite le réseau la 1re fois). */
export async function ocrImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['fra', 'eng'], 1, { logger: (m: { status: string; progress: number }) => m.status === 'recognizing text' && onProgress?.(m.progress) })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}

/** Photo de ticket prise depuis l'accueil, à traiter par l'écran de dépense rapide. */
export const pendingTicket: { file?: File } = {}
