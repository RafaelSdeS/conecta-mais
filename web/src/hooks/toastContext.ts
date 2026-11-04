/**
 * Contexto compartilhado de toast — importado tanto pelo provider (.tsx)
 * quanto pelo hook (.ts), evitando que o mesmo arquivo exporte componente + hook.
 */

import { createContext, useContext } from 'react'

export interface ToastItem {
  id:      number
  message: string
}

export interface ToastContextValue {
  toasts: ToastItem[]
  toast:  (message: string, duration?: number) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast:  () => {},
})

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
