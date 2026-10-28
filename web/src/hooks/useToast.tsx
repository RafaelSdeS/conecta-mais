/**
 * Hook simples de toast notifications.
 * Exporta um contexto global para que qualquer componente possa disparar toasts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

interface ToastItem {
  id: number
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: () => {},
})

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

export function useToast() {
  return useContext(ToastContext)
}
