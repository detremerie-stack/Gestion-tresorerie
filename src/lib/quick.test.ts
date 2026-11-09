import { describe, expect, it } from 'vitest'
import { parsePaymentText } from './quick'

describe('parsePaymentText', () => {
  it('reads Google Wallet style notifications', () => {
    expect(parsePaymentText('LE FOURNIL ARUE', 'XPF 2 890 avec Visa •••• 5778')).toEqual({ amount: 2890, currency: 'XPF', merchant: 'LE FOURNIL ARUE', last4: '5778' })
    expect(parsePaymentText('Carrefour Arue', '12 450 F · Carte ••5778')).toMatchObject({ amount: 12450, currency: 'XPF', last4: '5778' })
    expect(parsePaymentText('Spotify', '10,99 € payés avec American Express ••1014')).toEqual({ amount: 10.99, currency: 'EUR', merchant: 'Spotify', last4: '1014' })
    expect(parsePaymentText('Steam', 'Paiement de 13.99 USD')).toMatchObject({ amount: 13.99, currency: 'USD', merchant: 'Steam' })
  })
  it('finds the merchant inside a single text', () => {
    expect(parsePaymentText('', 'Paiement de 4 615 XPF chez SC CHAMPION MAHINA avec la carte 5778')).toEqual({ amount: 4615, currency: 'XPF', merchant: 'SC CHAMPION MAHINA', last4: '5778' })
  })
  it('returns nothing usable for unrelated text', () => {
    expect(parsePaymentText('Rappel', 'Réunion à 14h').amount).toBeUndefined()
  })
})
