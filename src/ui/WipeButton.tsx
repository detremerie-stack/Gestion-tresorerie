import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { wipeDevice } from '../lib/wipe'

/** « Se déconnecter et effacer cet appareil » (spécification 21 § 9), avec confirmation claire. */
export function WipeButton() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" className="btn danger-fill" onClick={() => setOpen(true)}><Trash2 size={18} />Se déconnecter et effacer cet appareil</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Effacer cet appareil ?"
        actions={<>
          <button type="button" className="btn danger-fill" disabled={busy} onClick={() => { setBusy(true); void wipeDevice() }}>Effacer cet appareil</button>
          <button type="button" className="btn" data-autofocus onClick={() => setOpen(false)}>Annuler</button>
        </>}>
        <p style={{ margin: 0 }}>Tout Fare Moni est supprimé de cet appareil : opérations, abonnements, comptes, photos de tickets, réglages et code. Vous êtes aussi déconnecté de Google.</p>
        <p style={{ margin: 0 }} className="muted">Si le partage est activé, tout reste sur l'autre téléphone et revient quand vous vous reconnectez ; sinon, faites d'abord une copie (Réglages › Sauvegarde).</p>
      </Dialog>
    </>
  )
}
