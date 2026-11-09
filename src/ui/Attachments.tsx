import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Paperclip, X } from 'lucide-react'
import type { AttachmentMeta } from '../data/types'
import { attachmentUrl, deleteAttachment, saveAttachment } from '../lib/attachments'

export function AttachmentThumb({ meta, onRemove }: { meta: AttachmentMeta; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let u: string | undefined
    void attachmentUrl(meta.id).then((x) => { u = x; setUrl(x) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [meta.id])
  return (
    <div className="thumb">
      <a href={url} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${meta.name}`}>
        {meta.type.startsWith('image/') && url ? <img src={url} alt={meta.name} /> : <FileText size={28} />}
      </a>
      {onRemove && <button type="button" className="thumb-del" aria-label={`Retirer ${meta.name}`} onClick={onRemove}><X size={14} /></button>}
    </div>
  )
}

/** Justificatifs d'une opération : photo du ticket (appareil photo), PDF ou image. */
export function Attachments({ value, onChange }: { value: AttachmentMeta[]; onChange: (v: AttachmentMeta[]) => void }) {
  const cam = useRef<HTMLInputElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const metas = await Promise.all([...files].map(saveAttachment))
      onChange([...value, ...metas])
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field">
      <span className="label">Justificatifs</span>
      {value.length > 0 && (
        <div className="thumbs">
          {value.map((m) => <AttachmentThumb key={m.id} meta={m} onRemove={() => { void deleteAttachment(m.id); onChange(value.filter((x) => x.id !== m.id)) }} />)}
        </div>
      )}
      <div className="btn-row">
        <button type="button" className="btn sm" disabled={busy} onClick={() => cam.current?.click()}><Camera size={16} />Photo du ticket</button>
        <button type="button" className="btn sm" disabled={busy} onClick={() => file.current?.click()}><Paperclip size={16} />Fichier / PDF</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void add(e.target.files)} />
      <input ref={file} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => void add(e.target.files)} />
      <span className="hint">Conservés sur ce téléphone (non synchronisés).</span>
    </div>
  )
}
