# DESIGN.md — Fare Moni (v2)

> Source de vérité dans le code : `src/styles/tokens.css` (couleurs, mesures), `src/styles/app.css` (téléphone et
> commun), `src/styles/desktop.css` (PC). Spécification d'origine : phase 2 (designer, avis de la décoratrice).

## Direction
Sable, lagon, corail. Fond sable chaud, cartes claires, le lagon pour l'action et le bandeau d'accueil,
le corail pour les sorties d'argent. Le rouge est réservé aux alertes (dépassement, solde négatif, effacement).
Sombre : « nuit de lagon ». Chiffres en gros, tabulaires, lisibles au soleil. Mots de tous les jours.

## Couleurs (rôles) — contrastes WCAG 2.1 vérifiés
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` | `#F6F3EE` | `#0C1517` | fond de page |
| `--surface` | `#FFFDF9` | `#14211F` | cartes, champs, dialogues |
| `--surface-2` | `#EFEAE2` | `#1C2C2A` | segments, en-têtes de jour, touches. **Aucun texte coloré dessus** |
| `--hover` | `#F3EFE9` | `#1A2A28` | survol (pointeur fin seulement) |
| `--border` / `--field-border` | `#E4DDD2` / `#8F877B` | `#2A3B39` / `#5F7471` | séparateurs / bords de champs, puces, boutons secondaires |
| `--text` / `--text-2` / `--text-3` | `#1A2326` / `#55605F` / `#5F6866` | `#EDF2F0` / `#A8B8B4` / `#93A39F` | texte |
| `--primary` / `--btn-primary` / `--on-primary` | `#0E7490` / `#0E7490` / `#FFF` | `#3BB3CF` / `#22A3C4` / `#04212A` | liens, focus / bouton principal |
| `--expense` | `#B8442A` | `#FF9A80` | sorties ordinaires (corail) |
| `--income` | `#2F7A3E` | `#6FD08A` | entrées |
| `--danger` / `--on-danger` | `#B42318` / `#FFF` | `#FF6F61` / `#2A0B07` | dépassement, découvert, « Effacer » |
| `--warning` | `#9A5B0B` | `#F2B544` | « Prévu le … », alertes douces |
| `--lagoon` | dégradé `#0C6680 → #164E63` | `#0A5266 → #123F50` | bandeau d'accueil, fond de `/rapide` et du verrou sur PC |
| `--side-bg` | dégradé `#0B5E74 → #123F4D` | `#08404F → #0B262E` (+ bord 1 px) | barre latérale PC |
| `--sun` | `#FFD166` | idem | repère de l'entrée active |

- **Le signe `−`/`+` est toujours affiché** : la couleur n'est jamais le seul indice.
- **Catégories** : la couleur enregistrée (`color`, synchronisée) n'est jamais modifiée ; elle est adoucie à
  l'affichage. Pastille : fond `color-mix(var(--c) 15 %, surface)`, picto `color-mix(var(--c) 70 %, #000)` (sombre :
  22 % / 55 % + blanc). Barres : `color-mix(var(--c) 75 %, surface)` en clair, `70 %` + blanc en sombre.
- Sur le lagon, le texte est blanc (tuile « Aujourd'hui sur nos comptes » en blanc pur) et le focus est blanc.

## Typographie
Pile système (`system-ui`, Roboto sur Android), aucune police téléchargée. Chiffres tabulaires.
| Rôle | Taille / graisse |
|---|---|
| Grand chiffre de l'accueil | 40 px / 800 (PC 48) |
| Titre de page | 24 px / 700 (PC 28) |
| Titre de section | 15 px / 600, minuscules |
| Corps | 16 px |
| Secondaire | 13–14 px |
| Axes des graphiques | 13 px fixe (SVG dessiné à sa taille réelle) |

## Espacements, formes, cibles
Base 4 px (4, 8, 12, 16, 24, 32, 48). Rayons : 10 champs, 16 cartes, 24 bandeau et panneaux, pilule pour puces et boutons.
**Cibles ≥ 44 px** (puces, `.btn.sm`, liens d'action des titres, lignes de catégories ; segments 38 px + zone étendue).
Bouton désactivé : fond `--border`, texte `--text-3`, sans transparence.

## Mise en page
| Largeur | Mise en page |
|---|---|
| < 900 px, ou hauteur < 500 px (téléphone, même couché) | barre du bas 5 zones : Accueil · Historique · (+) · Abonnements · Menu |
| ≥ 900 px et ≥ 500 px de haut | barre latérale 240 px ; pages 720 px (formulaires), `.page.wide` 1200 px (listes) ; dialogues centrés 480 px |
| ≥ 1280 px | accueil sur 2 colonnes (7 fr / 5 fr) |

Les deux navigations sont dans le DOM ; le CSS masque celle qui ne sert pas (aucun `matchMedia`).
`.desk-only` / `.phone-only` : éléments réservés à un format.

**Barre latérale** (ordre fixe) : Accueil, Historique, Abonnements, Les mois à venir, Où part notre argent,
Importer un relevé | Voyages, Crédits, Comptes, Limites de dépenses, Tickets et factures | Réglages, Partage.
Bouton « + Nouvelle dépense » (touche `N`) en haut. **Menu téléphone** : Le plus utile · Notre argent · Réglages.

## Composants
- **Accueil** : 1) « Il restera fin {mois} » (fonction unique `endOfMonth`) + « une fois payé ce qui est prévu… »
  + « par jour » + « Aujourd'hui sur nos comptes » ; 2) À confirmer et à payer d'ici 7 jours ; 3) Ce mois-ci ; 4) Dernières opérations (3 téléphone, 5 PC).
  Mode Complet : Limites du mois, En bref.
- **(+)** = Dépense rapide dans les deux modes ; « Autre chose ? » ouvre le choix Revenu / Entre nos comptes /
  Dépense détaillée / Abonnement / Voyage.
- **Dialogue** (`ui/Dialog.tsx`) : `<dialog>` natif, Échap, focus piégé puis rendu ; feuille du bas sur téléphone.
- **Historique** : lignes groupées par jour ; sur PC, colonnes Date · Description · Catégorie · Compte · Montant ;
  200 lignes puis « Voir plus ».
- **États vides** : icône 40 px `--text-3`, titre 17/600, texte 15 px, une action au plus.

## Clavier (PC)
`N` nouvelle dépense · `/` recherche de l'Historique · sur `/rapide` : chiffres, virgule, Retour arrière, Entrée
(enregistrer), Échap (fermer) · verrou : chiffres. Jamais actifs dans un champ, avec Ctrl/Cmd/Alt, ni sous un dialogue.

## Mots
Écran = libellé du menu. « Solde » pour le solde d'un compte ; « Débit / Crédit / Libellé » sur le relevé imprimé
et l'export CSV ; ailleurs « Entrées / Sorties », « Entre nos comptes », « mensualité » (crédits), « Partage »,
« Réglages ». Mois en minuscules (« vendredi 13 novembre »), décimales avec une virgule (« 2,8 % »), taux à 2 décimales.
**Fin de mois — un seul chiffre porte « Il restera fin {mois} »**, identique sur l'accueil et en tête de « Les mois à venir »
(fonction `endOfMonth`, hook `useEndOfMonth`), avec dessous « une fois payé ce qui est prévu (abonnements, crédits, factures) ».
Le chiffre qui déduit aussi les dépenses du quotidien estimées porte toujours la mention **« si vous dépensez comme
d'habitude »** (« Si vous dépensez comme d'habitude d'ici là (environ X F) : Y F », « Fin décembre, si vous dépensez comme
d'habitude », « Au plus bas d'ici {mois} »). Jamais « fin {mois} » tout seul pour ce second chiffre.
