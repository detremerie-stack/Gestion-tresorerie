import { createStore, del, get, keys, set } from 'idb-keyval'
import type { AttachmentMeta } from '../data/types'
import { uid } from './id'

// Fichiers sur l'appareil (IndexedDB) ; copiés dans Supabase Storage (dossier du foyer) quand la synchro est active.
const store = createStore('fare-moni-docs', 'files')
const pending = createStore('fare-moni-docs-pending', 'uploads')
const BUCKET = 'justificatifs'

async function remote() {
  const { getClient } = await import('../data/sync')
  const { useStore } = await import('../data/store')
  const c = getClient()
  const hid = useStore.getState().sync.householdId
  return c && hid ? { c, hid } : null
}

/** Envoie les justificatifs en attente (appelé après chaque synchronisation). */
export async function flushUploads(): Promise<void> {
  const r = await remote()
  if (!r) return
  for (const id of (await keys(pending)) as string[]) {
    const blob = await get<Blob>(id, store)
    if (!blob) { await del(id, pending); continue }
    const { error } = await r.c.storage.from(BUCKET).upload(`${r.hid}/${id}`, blob, { contentType: blob.type, upsert: true })
    if (!error) await del(id, pending)
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
  const meta: AttachmentMeta = { id: uid(), name: file.name || 'ticket.jpg', type: blob.type || file.type, size: blob.size, createdAt: new Date().toISOString() }
  await set(meta.id, blob, store)
  await set(meta.id, true, pending)
  void flushUploads().catch(() => {})
  return meta
}

export async function attachmentUrl(id: string): Promise<string | undefined> {
  let blob = await get<Blob>(id, store)
  if (!blob) {
    // Justificatif ajouté sur l'autre téléphone : téléchargé puis gardé en cache.
    const r = await remote().catch(() => null)
    const dl = r ? await r.c.storage.from(BUCKET).download(`${r.hid}/${id}`) : null
    if (dl?.data) { blob = dl.data; await set(id, blob, store) }
  }
  return blob ? URL.createObjectURL(blob) : undefined
}

export async function deleteAttachment(id: string) {
  await del(id, store)
  await del(id, pending)
  const r = await remote().catch(() => null)
  if (r) await r.c.storage.from(BUCKET).remove([`${r.hid}/${id}`])
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
