import { useEffect, useState } from 'react'

/** QR code (SVG) généré dans le téléphone, sans service externe. */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    void import('qrcode').then((q) => q.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1a20', light: '#ffffff' } })).then((s) => alive && setSvg(s))
    return () => { alive = false }
  }, [value])
  return <div role="img" aria-label={`QR code : ${value}`} style={{ width: size, height: size, background: '#fff', borderRadius: 12, padding: 8 }} dangerouslySetInnerHTML={{ __html: svg }} />
}
