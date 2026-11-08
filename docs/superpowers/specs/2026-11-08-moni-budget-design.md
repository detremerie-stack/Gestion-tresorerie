# Moni — Budget du foyer (Polynésie) · Spécification v1

> *Moni* = « argent » en reo tahiti.

## Intention
- **Pour qui :** Lionel et Véra, un foyer à Tahiti, sur Android (et ordinateur).
- **Quoi :** remplacer l'app d'abonnements actuelle (Paramapp) puis gérer tout le budget
  à la manière de Toshl Money : dépenses, revenus, comptes, budgets, rapports, import de relevés.
- **Succès :** les deux voient les mêmes chiffres en XPF, justes (XPF sans décimales,
  euro à parité fixe), savent ce qui va être prélevé et où part l'argent chaque mois.

## Décisions
| Sujet | Choix | Pourquoi |
|---|---|---|
| Plateforme | Web app installable (PWA), mobile d'abord | Android + PC sans store ; installable plus tard (TWA/Capacitor) |
| Stack | Vite + React + TypeScript, Zustand, CSS à tokens | Léger, rapide, sans dépendance UI lourde |
| Stockage | Local d'abord (IndexedDB) | Marche hors ligne et sans configuration |
| Partage | Supabase (optionnel) : une table générique `records` (jsonb) par foyer, RLS par membre, temps réel | Schéma évolutif sans migration à chaque nouvelle fonctionnalité |
| Conflits | Dernière écriture gagne (horodatage serveur) | Suffisant pour 2 personnes |

## Couche locale (Polynésie)
- XPF (F CFP) **sans décimales**, séparateur de milliers espace, suffixe `F`.
- **1 EUR = 119,331742 XPF** (parité fixe 1 000 XPF = 8,38 €) — jamais « ≈ » pour l'euro.
- USD et autres : taux BCE (frankfurter.app) EUR→USD × parité ; repli sur taux manuel.
- Frais de change par compte (ex. AmEx ~2,5 %) → coût réel estimé des abonnements en devises.
- Dates JJ/MM/AAAA, fuseau du téléphone (Pacific/Tahiti).
- Catégories et règles d'auto-catégorisation pré-remplies avec les acteurs locaux
  (EDT, Vini, Viti, Ora, Vodafone, OPT, CPS, Carrefour, Champion, Super U, Aremiti, Air Tahiti…).
- Banques prêtes : Banque de Tahiti, Socredo, Banque de Polynésie, American Express, Deblock.

## Fonctionnalités v1
1. **Accueil** : solde total, dépenses/revenus du mois, budgets, prochains prélèvements.
2. **Opérations** : dépenses, revenus, virements ; recherche, filtres (mois, compte, catégorie,
   étiquette, membre) ; montant saisi en devise étrangère converti en XPF.
3. **Abonnements** : coût mensuel/annuel, cycles (jours/semaines/mois/ans × N), essai gratuit,
   pause/résilié, paiements à venir, coût par étiquette, « marquer payé » → opération.
4. **Budgets** mensuels par catégorie, barre de progression.
5. **Rapports** : répartition par catégorie, évolution sur 6/12 mois, revenus vs dépenses.
6. **Comptes** avec soldes calculés.
7. **Import de relevés** CSV/OFX : détection séparateur/format, mapping de colonnes mémorisé par
   compte, aperçu, détection des doublons, auto-catégorisation.
8. **Relevé imprimable** par compte et par période (impression / PDF du navigateur).
9. **Paramètres** : taux, catégories, règles, membres, synchronisation, sauvegarde JSON, thème.

## Hors périmètre v1
Import PDF de relevés (formats à fournir par l'utilisateur), connexion bancaire directe,
notifications push, app store.

## Tests
Vitest sur la logique pure : formatage/conversion, dates & récurrences, abonnements,
parseurs CSV/OFX, règles, agrégations.
