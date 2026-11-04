/**
 * ToastProvider — provedor do contexto de toast notifications.
 * Exporta apenas o componente (sem hooks) para satisfazer a regra
 * react/only-export-components do oxlint.
 *
 * Use `useToast` importando de './toastContext'.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext, type ToastItem } from './toastContext'

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, duration = 2400) => {
    const id = ++nextId
    setToasts((t) => [...t, { id, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
    </ToastContext.Provider>
  )
}
