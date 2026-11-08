import {
  Baby, Briefcase, Car, CircleDashed, CreditCard, Droplets, Fuel, Gift, HandCoins, HeartPulse, Home, Landmark,
  PawPrint, Plane, PlusCircle, Palmtree, Repeat, Ship, Shield, ShoppingBag, ShoppingCart, Sofa, Tag, Undo2,
  Utensils, Wifi, Zap, Wallet, PiggyBank, Banknote, GraduationCap, Dumbbell, Music, Gamepad2, Coffee, Wrench,
  Smartphone, Tv, Shirt, Scissors, Bus, Fish, Waves, Users, type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  home: Home, zap: Zap, droplets: Droplets, wifi: Wifi, 'shopping-cart': ShoppingCart, utensils: Utensils, fuel: Fuel,
  car: Car, ship: Ship, 'heart-pulse': HeartPulse, shield: Shield, repeat: Repeat, palmtree: Palmtree,
  'shopping-bag': ShoppingBag, baby: Baby, sofa: Sofa, plane: Plane, landmark: Landmark, 'credit-card': CreditCard,
  gift: Gift, 'paw-print': PawPrint, 'circle-dashed': CircleDashed, briefcase: Briefcase, 'hand-coins': HandCoins,
  'undo-2': Undo2, tag: Tag, 'plus-circle': PlusCircle, wallet: Wallet, 'piggy-bank': PiggyBank, banknote: Banknote,
  'graduation-cap': GraduationCap, dumbbell: Dumbbell, music: Music, gamepad: Gamepad2, coffee: Coffee, wrench: Wrench,
  smartphone: Smartphone, tv: Tv, shirt: Shirt, scissors: Scissors, bus: Bus, fish: Fish, waves: Waves, users: Users,
}

export function Icon({ name, size = 20 }: { name?: string; size?: number }) {
  const C = (name && ICONS[name]) || CircleDashed
  return <C size={size} aria-hidden="true" />
}

export function CatIcon({ icon, color, small }: { icon?: string; color?: string; small?: boolean }) {
  return (
    <span className={`cat-icon${small ? ' sm' : ''}`} style={{ background: color ?? '#6B7280' }}>
      <Icon name={icon} size={small ? 16 : 20} />
    </span>
  )
}
