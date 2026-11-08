import { create } from 'zustand'
import { useEffect } from 'react'

interface ToastState {
  message?: string
  action?: { label: string; run: () => void }
  key: number
  show: (message: string, action?: { label: string; run: () => void }) => void
  hide: () => void
}

export const useToast = create<ToastState>((set) => ({
  key: 0,
  show: (message, action) => set((s) => ({ message, action, key: s.key + 1 })),
  hide: () => set({ message: undefined, action: undefined }),
}))

export function Toaster() {
  const { message, action, key, hide } = useToast()
  useEffect(() => {
    if (!message) return
    const t = setTimeout(hide, action ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [key, message, action, hide])
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button onClick={() => { action.run(); hide() }}>{action.label}</button>
      )}
    </div>
  )
}
