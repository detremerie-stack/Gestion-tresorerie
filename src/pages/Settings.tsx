import { useEffect, useRef, useState } from 'react'
import { biometricAvailable, checkPin, disableBiometric, disableLock, enableBiometric, hasBiometric, isLockEnabled, setPin } from '../lib/lock'
import { PinPad } from '../ui/LockScreen'
import { Download, RefreshCw, Upload } from 'lucide-react'
import { useStore } from '../data/store'
import { useMembers } from '../data/hooks'
import { KINDS, type Kind } from '../data/types'
import { CURRENCIES, EUR_XPF, parseAmount, type Currency } from '../lib/money'
import { fetchRates } from '../lib/rates'
import { formatDate, today } from '../lib/dates'
import { archiveStart } from '../lib/forecast'
import { Page, Section } from '../ui/Page'
import { Segmented } from '../ui/Field'
import { useToast } from '../ui/toast'

function LockSettings() {
  const toast = useToast((s) => s.show)
  const [enabled, setEnabled] = useState(isLockEnabled())
  const [bio, setBio] = useState(hasBiometric())
  const [bioOk, setBioOk] = useState(false)
  const [step, setStep] = useState<null | 'new' | 'confirm' | 'off'>(null)
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()
  useEffect(() => { void biometricAvailable().then(setBioOk) }, [])
  if (step) {
    return (
      <div className="backdrop" style={{ alignItems: 'stretch', background: 'var(--bg)' }}>
        <div style={{ width: '100%' }}>
          <PinPad error={error}
            title={step === 'new' ? 'Choisissez un code' : step === 'confirm' ? 'Confirmez le code' : 'Entrez votre code'}
            subtitle={step === 'off' ? 'Pour retirer le verrouillage' : '4 chiffres'}
            extra={<button type="button" onClick={() => { setStep(null); setError(undefined) }} style={{ fontSize: 14 }}>Annuler</button>}
            onComplete={async (pin) => {
              if (step === 'new') { setFirst(pin); setError(undefined); setStep('confirm') }
              else if (step === 'confirm') {
                if (pin !== first) { setError('Les deux codes sont différents'); setStep('new'); return }
                await setPin(pin); setEnabled(true); setStep(null); toast('Verrouillage activé')
              } else if (await checkPin(pin)) { disableLock(); setEnabled(false); setBio(false); setStep(null); toast('Verrouillage retiré') }
              else setError('Code incorrect')
            }} />
        </div>
      </div>
    )
  }
  return (
    <Section title="Sécurité">
      <div className="card form">
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={() => { setError(undefined); setStep(enabled ? 'off' : 'new') }} />
          <span><strong>Verrouiller l'app par un code</strong><br /><span className="faint">Demandé à l'ouverture et après 2 minutes d'absence.</span></span>
        </label>
        {enabled && bioOk && (
          <label className="check">
            <input type="checkbox" checked={bio} onChange={async () => {
              if (bio) { disableBiometric(); setBio(false) } else if (await enableBiometric()) { setBio(true); toast('Empreinte activée') } else toast('Empreinte non activée sur ce téléphone')
            }} />
            <span><strong>Déverrouiller avec l'empreinte ou le visage</strong><br /><span className="faint">Le code reste utilisable.</span></span>
          </label>
        )}
        <span className="faint">Réglage propre à ce téléphone. Code oublié : il faudra effacer les données de l'app dans Chrome puis vous reconnecter au foyer (vos données partagées sont conservées).</span>
      </div>
    </Section>
  )
}

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const upsert = useStore((s) => s.upsert)
  const replaceAll = useStore((s) => s.replaceAll)
  const toast = useToast((s) => s.show)
  const members = useMembers()
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const rates = await fetchRates()
      setSettings({ rates: { ...settings.rates, ...rates }, ratesUpdatedAt: new Date().toISOString() })
      toast('Taux mis à jour')
    } catch (e) {
      toast(`Impossible de récupérer les taux : ${e instanceof Error ? e.message : e}. Saisissez-les à la main.`)
    } finally {
      setLoading(false)
    }
  }

  const exportJSON = () => {
    const s = useStore.getState()
    const blob = new Blob([JSON.stringify({ app: 'moni', version: 1, exportedAt: new Date().toISOString(), data: s.data, settings: s.settings }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fare-moni-sauvegarde-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJSON = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      if (json.app !== 'moni' || !json.data) throw new Error('Ce fichier n’est pas une sauvegarde Moni.')
      const counts = KINDS.map((k: Kind) => Object.keys(json.data[k] ?? {}).length)
      if (!confirm(`Restaurer ${counts.reduce((a, b) => a + b, 0)} éléments ? Les éléments de même identifiant seront remplacés.`)) return
      const s = useStore.getState()
      const merged = Object.fromEntries(KINDS.map((k) => [k, { ...s.data[k], ...(json.data[k] ?? {}) }]))
      replaceAll(merged)
      toast('Sauvegarde restaurée')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fichier illisible')
    }
  }

  const editable = CURRENCIES.filter((c) => c.code !== 'XPF' && c.code !== 'EUR')

  return (
    <Page title="Paramètres" back>
      <Section title="Cet appareil">
        <div className="card form">
          <div className="field">
            <span className="label">Je suis</span>
            <Segmented label="Membre" value={settings.currentMember ?? ''} onChange={(v) => setSettings({ currentMember: v })} options={members.map((m) => ({ value: m.id, label: m.name }))} />
          </div>
          <div className="field">
            <span className="label">Affichage</span>
            <Segmented label="Affichage" value={settings.mode ?? 'simple'} onChange={(v) => setSettings({ mode: v })} options={[{ value: 'simple', label: 'Simple' }, { value: 'complet', label: 'Complet' }]} />
            <span className="hint">Simple : l'essentiel, sans jargon. Complet : tous les outils (budgets, rapprochement, raccourcis d'ajout).</span>
          </div>
          <div className="field">
            <span className="label">Thème</span>
            <Segmented label="Thème" value={settings.theme} onChange={(v) => setSettings({ theme: v })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />
          </div>
        </div>
      </Section>

      <LockSettings />

      <Section title="Historique affiché">
        <div className="card form">
          <Segmented label="Années affichées" value={String(settings.visibleYears ?? 2)} onChange={(v) => setSettings({ visibleYears: Number(v) })}
            options={[{ value: '1', label: '1 an' }, { value: '2', label: '2 ans' }, { value: '3', label: '3 ans' }, { value: '5', label: '5 ans' }]} />
          <span className="faint">
            Les opérations avant le {formatDate(archiveStart(today(), settings.visibleYears ?? 2))} sont archivées : toujours comptées dans les soldes et consultables (Opérations › Archives),
            mais masquées au quotidien. La fenêtre avance automatiquement chaque 1er janvier.
          </span>
        </div>
      </Section>

      <Section title="Membres du foyer">
        <div className="card form">
          {members.map((m) => (
            <div key={m.id} className="input-group">
              <input className="input" defaultValue={m.name} aria-label="Nom" onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && upsert('members', { ...m, name: e.target.value.trim() })} />
              <input type="color" className="input" style={{ width: 56, padding: 4 }} value={m.color} aria-label={`Couleur de ${m.name}`} onChange={(e) => upsert('members', { ...m, color: e.target.value })} />
            </div>
          ))}
          <button className="btn" onClick={() => upsert('members', { name: 'Nouveau membre', color: '#4F46E5' })}>Ajouter un membre</button>
        </div>
      </Section>

      <Section title="Taux de change (F CFP)">
        <div className="card form">
          <div className="split"><span>1 EUR</span><strong className="num">{EUR_XPF.toFixed(5).replace('.', ',')} F</strong></div>
          <p className="faint" style={{ margin: 0 }}>Parité fixe garantie : 1 000 F CFP = 8,38 €. Aucune approximation pour l'euro.</p>
          {editable.map((c) => (
            <div key={c.code} className="split">
              <label htmlFor={`rate-${c.code}`}>1 {c.code} <span className="faint">{c.label}</span></label>
              <input id={`rate-${c.code}`} className="input num" style={{ maxWidth: 120, textAlign: 'right' }} inputMode="decimal"
                defaultValue={String(settings.rates[c.code as Currency] ?? '').replace('.', ',')} key={settings.ratesUpdatedAt ?? 'manual'}
                onBlur={(e) => { const v = parseAmount(e.target.value); if (v > 0) setSettings({ rates: { ...settings.rates, [c.code]: v } }) }} />
            </div>
          ))}
          <button className="btn" onClick={refresh} disabled={loading}><RefreshCw size={18} />{loading ? 'Mise à jour…' : 'Mettre à jour (BCE)'}</button>
          <span className="faint">{settings.ratesUpdatedAt ? `Mis à jour le ${formatDate(settings.ratesUpdatedAt.slice(0, 10))}.` : 'Taux par défaut approximatifs : mettez-les à jour.'}</span>
        </div>
      </Section>

      <Section title="Sauvegarde">
        <div className="card form">
          <p className="faint" style={{ margin: 0 }}>Les données sont enregistrées sur ce téléphone{useStore.getState().sync.householdId ? ' et synchronisées avec votre foyer' : ''}. Gardez aussi une copie de temps en temps.</p>
          <div className="btn-row">
            <button className="btn" onClick={exportJSON}><Download size={18} />Exporter (JSON)</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={18} />Restaurer</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </div>
        </div>
      </Section>
    </Page>
  )
}
