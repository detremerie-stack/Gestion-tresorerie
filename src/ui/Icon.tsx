import * as L from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { normalize } from '../lib/id'

/**
 * Bibliothèque de pictogrammes des catégories : clé stockée → icône + mots-clés français (recherche).
 * Les clés historiques (home, zap, …) restent valables.
 */
const LIB: [key: string, icon: LucideIcon, keywords: string, group: string][] = [
  ['home', L.Home, 'maison logement loyer', 'Maison'], ['building', L.Building, 'immeuble appartement bureau', 'Maison'],
  ['sofa', L.Sofa, 'meuble salon maison', 'Maison'], ['bed', L.Bed, 'lit chambre hotel', 'Maison'], ['bath', L.Bath, 'salle de bain', 'Maison'],
  ['lamp', L.Lamp, 'lampe deco', 'Maison'], ['lightbulb', L.Lightbulb, 'ampoule idee', 'Maison'], ['hammer', L.Hammer, 'bricolage travaux', 'Maison'],
  ['wrench', L.Wrench, 'reparation garage entretien', 'Maison'], ['paintbrush', L.Paintbrush, 'peinture travaux', 'Maison'],
  ['key', L.KeyRound, 'cle serrure', 'Maison'], ['washing', L.WashingMachine, 'lave-linge electromenager', 'Maison'],
  ['fridge', L.Refrigerator, 'frigo electromenager', 'Maison'], ['microwave', L.Microwave, 'micro-ondes cuisine', 'Maison'], ['fan', L.Fan, 'ventilateur clim', 'Maison'],
  ['sprout', L.Sprout, 'jardin plantes', 'Maison'], ['shovel', L.Shovel, 'jardinage', 'Maison'], ['flower', L.Flower2, 'fleurs jardin', 'Maison'],
  ['zap', L.Zap, 'electricite edt', 'Factures'], ['droplets', L.Droplets, 'eau', 'Factures'], ['flame', L.Flame, 'gaz', 'Factures'], ['plug', L.Plug, 'prise energie', 'Factures'],
  ['wifi', L.Wifi, 'internet box', 'Factures'], ['smartphone', L.Smartphone, 'telephone mobile', 'Factures'], ['phone', L.Phone, 'telephone fixe', 'Factures'],
  ['mail', L.Mail, 'courrier poste opt', 'Factures'], ['receipt', L.Receipt, 'facture ticket', 'Factures'], ['repeat', L.Repeat, 'abonnement recurrent', 'Factures'],
  ['shopping-cart', L.ShoppingCart, 'courses supermarche', 'Courses & repas'], ['store', L.Store, 'magasin boutique', 'Courses & repas'],
  ['utensils', L.Utensils, 'restaurant repas', 'Courses & repas'], ['coffee', L.Coffee, 'cafe snack', 'Courses & repas'], ['pizza', L.Pizza, 'pizza fast food', 'Courses & repas'],
  ['sandwich', L.Sandwich, 'sandwich snack roulotte', 'Courses & repas'], ['croissant', L.Croissant, 'boulangerie patisserie', 'Courses & repas'],
  ['cake', L.Cake, 'gateau anniversaire', 'Courses & repas'], ['ice-cream', L.IceCreamCone, 'glace dessert', 'Courses & repas'], ['apple', L.Apple, 'fruits marche', 'Courses & repas'],
  ['carrot', L.Carrot, 'legumes marche', 'Courses & repas'], ['fish', L.Fish, 'poisson peche', 'Courses & repas'], ['wine', L.Wine, 'vin alcool', 'Courses & repas'], ['beer', L.Beer, 'biere bar', 'Courses & repas'],
  ['shopping-bag', L.ShoppingBag, 'shopping achats', 'Shopping'], ['shirt', L.Shirt, 'vetements habits', 'Shopping'], ['gem', L.Gem, 'bijoux perle', 'Shopping'],
  ['watch', L.Watch, 'montre', 'Shopping'], ['glasses', L.Glasses, 'lunettes optique', 'Shopping'], ['scissors', L.Scissors, 'coiffeur beaute', 'Shopping'],
  ['sparkles', L.Sparkles, 'beaute soins cosmetique', 'Shopping'], ['package', L.Package, 'colis livraison commande', 'Shopping'], ['gift', L.Gift, 'cadeau', 'Shopping'],
  ['laptop', L.Laptop, 'ordinateur portable informatique', 'Informatique'], ['monitor', L.Monitor, 'ecran informatique', 'Informatique'], ['cpu', L.Cpu, 'composant informatique pc', 'Informatique'],
  ['keyboard', L.Keyboard, 'clavier informatique', 'Informatique'], ['mouse', L.Mouse, 'souris informatique', 'Informatique'], ['printer', L.Printer, 'imprimante encre', 'Informatique'],
  ['hard-drive', L.HardDrive, 'disque stockage nas', 'Informatique'], ['headphones', L.Headphones, 'casque audio musique', 'Informatique'], ['camera', L.Camera, 'appareil photo', 'Informatique'],
  ['tv', L.Tv, 'television streaming', 'Informatique'], ['gamepad', L.Gamepad2, 'jeux video console', 'Informatique'],
  ['dumbbell', L.Dumbbell, 'sport salle musculation fitness', 'Sport & loisirs'], ['bike', L.Bike, 'velo cyclisme', 'Sport & loisirs'], ['footprints', L.Footprints, 'course running marche', 'Sport & loisirs'],
  ['trophy', L.Trophy, 'competition trophee club', 'Sport & loisirs'], ['volleyball', L.Volleyball, 'volley ballon sport', 'Sport & loisirs'], ['waves', L.Waves, 'surf va a natation plage', 'Sport & loisirs'],
  ['sailboat', L.Sailboat, 'voile bateau va a', 'Sport & loisirs'], ['anchor', L.Anchor, 'bateau marine', 'Sport & loisirs'], ['mountain', L.Mountain, 'randonnee montagne', 'Sport & loisirs'],
  ['tent', L.Tent, 'camping', 'Sport & loisirs'], ['palmtree', L.Palmtree, 'loisirs vacances plage', 'Sport & loisirs'], ['music', L.Music, 'musique concert', 'Sport & loisirs'],
  ['guitar', L.Guitar, 'instrument musique', 'Sport & loisirs'], ['film', L.Film, 'cinema film', 'Sport & loisirs'], ['popcorn', L.Popcorn, 'cinema sortie', 'Sport & loisirs'],
  ['ticket', L.Ticket, 'billet spectacle evenement', 'Sport & loisirs'], ['party', L.PartyPopper, 'fete soiree', 'Sport & loisirs'], ['book', L.BookOpen, 'livre lecture', 'Sport & loisirs'],
  ['palette', L.Palette, 'art dessin loisirs creatifs', 'Sport & loisirs'],
  ['car', L.Car, 'voiture auto', 'Transport'], ['fuel', L.Fuel, 'carburant essence station', 'Transport'], ['bus', L.Bus, 'bus le truck transport', 'Transport'],
  ['ship', L.Ship, 'ferry bateau aremiti terevau iles', 'Transport'], ['plane', L.Plane, 'avion voyage vol', 'Transport'], ['train', L.TrainFront, 'train metro', 'Transport'], ['truck', L.Truck, 'camion demenagement', 'Transport'],
  ['heart-pulse', L.HeartPulse, 'sante medecin', 'Santé & famille'], ['stethoscope', L.Stethoscope, 'medecin consultation', 'Santé & famille'], ['pill', L.Pill, 'pharmacie medicament', 'Santé & famille'],
  ['syringe', L.Syringe, 'vaccin soins', 'Santé & famille'], ['hospital', L.Hospital, 'hopital clinique', 'Santé & famille'], ['baby', L.Baby, 'bebe enfant', 'Santé & famille'],
  ['school', L.School, 'ecole college lycee', 'Santé & famille'], ['graduation-cap', L.GraduationCap, 'etudes universite formation', 'Santé & famille'], ['backpack', L.Backpack, 'cartable rentree scolaire', 'Santé & famille'],
  ['users', L.Users, 'famille aide proches', 'Santé & famille'], ['heart', L.Heart, 'amour don', 'Santé & famille'], ['church', L.Church, 'eglise don religion', 'Santé & famille'],
  ['paw-print', L.PawPrint, 'animaux', 'Santé & famille'], ['dog', L.Dog, 'chien veterinaire', 'Santé & famille'], ['cat', L.Cat, 'chat veterinaire', 'Santé & famille'], ['bone', L.Bone, 'croquettes animaux', 'Santé & famille'],
  ['landmark', L.Landmark, 'banque impots administration credit', 'Argent'], ['credit-card', L.CreditCard, 'carte bancaire frais', 'Argent'], ['banknote', L.Banknote, 'especes billets retrait', 'Argent'],
  ['coins', L.Coins, 'monnaie pieces', 'Argent'], ['wallet', L.Wallet, 'portefeuille', 'Argent'], ['piggy-bank', L.PiggyBank, 'epargne economies', 'Argent'], ['hand-coins', L.HandCoins, 'pension allocation aide', 'Argent'],
  ['chart', L.ChartLine, 'placement bourse investissement', 'Argent'], ['percent', L.Percent, 'interets taux', 'Argent'], ['briefcase', L.Briefcase, 'salaire travail', 'Argent'],
  ['scale', L.Scale, 'justice avocat', 'Argent'], ['gavel', L.Gavel, 'amende tribunal', 'Argent'], ['shield', L.Shield, 'assurance', 'Argent'], ['shield-check', L.ShieldCheck, 'garantie protection', 'Argent'],
  ['umbrella', L.Umbrella, 'assurance prevoyance', 'Argent'], ['undo-2', L.Undo2, 'remboursement retour', 'Argent'], ['tag', L.Tag, 'vente', 'Argent'], ['plus-circle', L.PlusCircle, 'autre revenu', 'Argent'],
  ['cigarette', L.Cigarette, 'tabac', 'Divers'], ['leaf', L.Leaf, 'nature ecologie', 'Divers'], ['sun', L.Sun, 'ete soleil', 'Divers'], ['star', L.Star, 'favori special', 'Divers'],
  ['circle-dashed', L.CircleDashed, 'divers autre', 'Divers'],
]

export const ICONS: Record<string, LucideIcon> = Object.fromEntries(LIB.map(([k, i]) => [k, i]))
export const ICON_GROUPS = [...new Set(LIB.map((x) => x[3]))]
export function iconsOf(group?: string, search = ''): string[] {
  const q = normalize(search)
  return LIB.filter(([k, , kw, g]) => (!group || g === group) && (!q || normalize(`${k} ${kw}`).includes(q))).map(([k]) => k)
}

export function Icon({ name, size = 20 }: { name?: string; size?: number }) {
  const C = (name && ICONS[name]) || L.CircleDashed
  return <C size={size} aria-hidden="true" />
}

export function CatIcon({ icon, color, small }: { icon?: string; color?: string; small?: boolean }) {
  return (
    <span className={`cat-icon${small ? ' sm' : ''}`} style={{ background: color ?? '#6B7280' }}>
      <Icon name={icon} size={small ? 16 : 20} />
    </span>
  )
}
