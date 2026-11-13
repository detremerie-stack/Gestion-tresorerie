import { Copy, Info } from 'lucide-react'
import { Page, Section } from '../ui/Page'
import { useToast } from '../ui/toast'

/** Explique comment pré-remplir une dépense à partir de la notification de paiement Google Wallet (Android). */
export default function WalletHelp() {
  const toast = useToast((s) => s.show)
  const base = `${location.origin}${location.pathname}#/rapide`
  const link = `${base}?titre={not_title}&texte={not_text}`
  const copy = (v: string) => { void navigator.clipboard?.writeText(v); toast('Copié') }
  return (
    <Page title="Paiements Wallet" back>
      <div className="callout"><Info size={18} /><span>Android ne laisse pas une application web lire Google Wallet. Une petite application d'automatisation gratuite peut, elle, repérer la notification de paiement et ouvrir Fare Moni avec le montant et le commerçant déjà remplis : il ne reste qu'à valider.</span></div>
      <Section title="Mise en place (une seule fois, environ 5 minutes)">
        <ol className="card stack" style={{ margin: 0, paddingLeft: 36, gap: 10 }}>
          <li>Installez <strong>MacroDroid</strong> depuis le Play Store et autorisez l'<strong>accès aux notifications</strong>.</li>
          <li>Nouvelle macro › Déclencheur : <strong>Notification reçue</strong> › application <strong>Google Wallet</strong> (ajoutez aussi l'app de votre banque si elle notifie les paiements).</li>
          <li>Action : <strong>Ouvrir un site web / URL</strong>, collez le lien ci-dessous. MacroDroid remplace <code>{'{not_title}'}</code> et <code>{'{not_text}'}</code> par le titre et le texte de la notification.</li>
          <li>Dans <strong>Comptes</strong>, renseignez les 4 derniers chiffres de chaque carte (par exemple 1234) : Fare Moni choisira la bonne carte et la bonne personne.</li>
        </ol>
      </Section>
      <Section title="Lien à coller dans MacroDroid">
        <div className="card stack">
          <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{link}</code>
          <button className="btn" onClick={() => copy(link)}><Copy size={18} />Copier le lien</button>
        </div>
      </Section>
      <Section title="Variante simple">
        <div className="card stack">
          <span className="muted">Si votre automatisation sait extraire le montant et le commerçant, utilisez :</span>
          <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{`${base}?montant=2890&marchand=LE FOURNIL&carte=1234`}</code>
          <button className="btn" onClick={() => copy(`${base}?montant=&marchand=&carte=`)}><Copy size={18} />Copier le modèle</button>
        </div>
      </Section>
      <p className="faint" style={{ margin: 0 }}>Rien n'est enregistré automatiquement : vous validez chaque dépense. Les relevés importés ensuite ne créent pas de doublon si vous gardez le même montant et la même date (vérifiez l'aperçu d'import).</p>
    </Page>
  )
}
