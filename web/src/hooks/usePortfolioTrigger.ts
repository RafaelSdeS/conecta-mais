/**
 * Hook que observa budget + levers na store e dispara POST /portfolio
 * com debounce de 400ms. Atualiza portfolio e kpis na store.
 */

import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/appStore'

export function usePortfolioTrigger() {
  const budget              = useAppStore((s) => s.budget)
  const levers              = useAppStore((s) => s.levers)
  const municipios          = useAppStore((s) => s.municipios)
  const setPortfolioResult  = useAppStore((s) => s.setPortfolioResult)
  const setPortfolioLoading = useAppStore((s) => s.setPortfolioLoading)
  const setError            = useAppStore((s) => s.setError)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Sem municípios carregados ainda — não dispara
    if (municipios.length === 0) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setPortfolioLoading(true)
      try {
        const result = await api.postPortfolio({
          budget,
          lambda_: 0.5,
          max_payback: 10,
          alavancas: {
            backhaul_comprometido: levers.tcu,
            fust_reembolsavel:     levers.fust,
            receita_escolar:       levers.enec,
          },
        })
        setPortfolioResult(result)
      } catch (e) {
        // API offline durante desenvolvimento — ignora silenciosamente
        setError(String(e))
      } finally {
        setPortfolioLoading(false)
      }
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, levers, municipios.length])
}
