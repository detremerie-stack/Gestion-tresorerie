# Fare Moni — l'argent de la maison 🌺

> *Fare* : « maison », *moni* : « argent » en reo tahiti.

Application web (installable sur Android) pour gérer **les abonnements, les comptes et le budget**
d'un foyer en Polynésie française, à deux (Lionel et Véra), en **francs Pacifique (XPF)**.

## Fonctionnalités

| | |
|---|---|
| **Abonnements** | coût mensuel/annuel, cycles libres (jours/semaines/mois/ans), essais gratuits, pause/résiliation, paiements à venir, coût par étiquette et par compte, frais de change estimés, « Payé » → opération |
| **Opérations** | dépenses, revenus, virements entre comptes ; montant en devise converti ; recherche et filtres (mois, compte, catégorie, étiquette, membre) |
| **Comptes** | Banque de Tahiti, Socredo, Banque de Polynésie, American Express, Deblock, espèces ; soldes calculés |
| **Prêts** | crédit immo/auto/conso : mensualité, tableau d'amortissement, capital restant dû, intérêts payés et coût total, assurance emprunteur, remboursements anticipés, échéances à enregistrer, patrimoine net |
| **Prévisionnel** | solde prévu mois par mois (3/6/12 mois) : soldes actuels + entrées/sorties prévues (salaires, pension, impôts, rentrée…) + abonnements + prêts + voyages − dépenses courantes ; point bas et alerte de passage sous zéro ; récurrences détectées dans les opérations |
| **Voyages** | budget par poste (billets, hébergement… en XPF ou devise), compte à rebours, épargne mise de côté (ex. Deblock) et montant à épargner par mois, dépenses rattachées |
| **Archives** | seules les 2 dernières années sont affichées (réglable) ; l'historique plus ancien reste consultable et compte dans les soldes |
| **Dépense rapide** | pavé numérique, commerçants habituels en un geste, catégorie devinée ; raccourci « Dépense rapide » (appui long sur l'icône) ; pré-remplissage depuis une notification de paiement Google Wallet via MacroDroid (`#/rapide?titre=…&texte=…`), carte reconnue par ses 4 derniers chiffres |
| **Rapprochement** | à l'import d'un relevé, les saisies manuelles/Wallet correspondantes (même compte, montant, ±7 jours ; ±4 % si en devise) sont complétées au lieu d'être dupliquées ; « à rapprocher » signale les saisies pas encore vues sur un relevé |
| **Voyage & tickets** | mode voyage automatique (devise sur place, carte, rattachement, taux BCE du jour + frais de carte) ; photo du ticket lue par OCR dans le téléphone (Tesseract) : montant, devise, date, commerçant, catégorie ; justificatifs joints et page Documents (stockés sur l'appareil) |
| **Budgets** | plafond mensuel par catégorie, alerte de dépassement et de rythme |
| **Rapports** | évolution mensuelle, dépenses/revenus par catégorie, par personne, taux d'épargne |
| **Import de relevés** | CSV (séparateur, encodage et colonnes détectés, mapping mémorisé par compte) et OFX ; doublons ignorés ; catégorisation automatique |
| **Relevé imprimable** | par compte et période → impression / PDF, ou export CSV |
| **Partage** | synchronisation temps réel entre téléphones via Supabase (facultatif) |

### Couche locale Polynésie
- XPF **sans décimales** (`21 326 F`), dates JJ/MM/AAAA.
- **Euro à parité fixe** : 1 000 F = 8,38 € → montants en euros exacts (pas de « ≈ »).
- Autres devises au taux BCE du jour (bouton dans Paramètres), avec frais de change par carte.
- Catégories et ~75 règles pré-remplies : EDT, Vini, Viti, Ora, Vodafone, OPT, CPS, Carrefour, Champion,
  Super U, Total, Aremiti, Air Tahiti, roulottes…

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests de la logique (devises, dates, abonnements, import…)
npm run build    # version de production dans dist/
```

## Mettre en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` teste, construit et publie l'app à chaque push sur `main`.
Activez-le une fois : **Settings › Pages › Source : GitHub Actions**.
Sur Android : ouvrez l'adresse dans Chrome › menu ⋮ › **Installer l'application**.

## Partager entre Lionel et Véra (Supabase, gratuit)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** : collez et exécutez `supabase/schema.sql`.
3. **Project Settings › API** : copiez l'URL et la clé `anon` (publique).
4. Dans l'app : **Plus › Synchronisation**, collez-les (ou définissez `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` au build), créez un compte et **créez le foyer**.
5. Sur l'autre téléphone : même chose, puis **Rejoindre** avec le code d'invitation affiché.

Les données restent aussi sur chaque téléphone (hors ligne possible) ; la sécurité est assurée par
les règles RLS : seuls les membres d'un foyer voient ses données.

## Architecture

```
src/lib/        logique pure et testée (money, dates, subscriptions, reports, rules, import/)
src/data/       types, valeurs par défaut, store (Zustand + IndexedDB), synchro Supabase
src/ui/         composants (Money, Charts, champs…)
src/pages/      écrans
supabase/       schéma SQL (table générique `records` en jsonb, RLS par foyer)
DESIGN.md       jetons de design (couleurs, typo, espacements)
docs/superpowers/specs/  spécification
```
