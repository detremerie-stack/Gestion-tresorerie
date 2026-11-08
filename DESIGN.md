# DESIGN.md — Fare Moni

> Niveau de maturité : **L0 → L1**. Aucun design system n'existait ; ces valeurs ont été
> posées pour la v1 et sont **provisoires** : à réviser si un vrai DS est adopté.
> Source de vérité dans le code : `src/styles/tokens.css`.

## Direction
« Lagon » : surfaces claires et calmes, un bleu-vert de lagon comme couleur d'action,
le corail pour les sorties d'argent. Chiffres en gros, tabulaires, faciles à lire au soleil.
Pas de publicité, pas de décor inutile.

## Couleurs (rôles)
| Rôle | Clair | Sombre |
|---|---|---|
| `--bg` fond | `#F4F6F7` | `#0F1416` |
| `--surface` cartes | `#FFFFFF` | `#182024` |
| `--surface-2` champs, puces | `#EEF2F3` | `#212B30` |
| `--text` | `#0B1A20` | `#EEF3F4` |
| `--text-2` secondaire | `#4A5A60` | `#A9B8BD` |
| `--text-3` discret | `#5F6F74` | `#7D8D92` |
| `--primary` action | `#0E7490` | `#22A3C4` |
| `--on-primary` | `#FFFFFF` | `#00222C` |
| `--income` texte revenus | `#0F7A3D` | `#4ADE80` |
| `--expense` texte dépenses | `#B42318` | `#FF8A7A` |
| `--warning` | `#B45309` | `#FBBF24` |
| `--chart-income` | `#0891B2` | `#22A3C4` |
| `--chart-expense` | `#EB6834` | `#D95926` |

Les montants ne reposent jamais sur la couleur seule : signe `−`/`+` toujours affiché.
Palette des graphiques validée (CVD ΔE ≥ 15, contraste ≥ 3:1, clair et sombre).

## Typographie
Pile système (`system-ui`, Roboto sur Android). Chiffres `font-variant-numeric: tabular-nums`.
| Rôle | Taille / graisse |
|---|---|
| Hero (solde) | 34px / 700 |
| Titre de page | 24px / 700 |
| Titre de section | 13px / 600, majuscules, espacement 0.04em |
| Corps | 16px / 400 |
| Libellé secondaire | 13px / 400 |

## Espacements & formes
Base 4px : 4, 8, 12, 16, 24, 32, 48. Rayon : 10 (champs), 16 (cartes), 999 (puces).
Cibles tactiles ≥ 44px. Marge de page 16px ; contenu max 720px centré sur grand écran.

## Composition
- Navigation basse 5 zones : Accueil · Opérations · (+) · Abonnements · Plus.
- Le bouton (+) central ouvre l'ajout rapide (dépense, revenu, virement, abonnement).
- Listes groupées par jour ; une ligne = icône de catégorie, libellé, détail, montant.
- Formulaires en pleine page avec retour, bouton principal collé en bas.
- Suppression : toujours annulable (toast « Annuler » 6 s).

## Graphiques
- Dépenses par catégorie : barres horizontales classées, une teinte (pas de camembert).
- Évolution mensuelle : colonnes groupées revenus/dépenses + légende, info-bulle au toucher.
- Budgets : jauges ; > 100 % = texte « Dépassé » + icône, pas seulement la couleur.
