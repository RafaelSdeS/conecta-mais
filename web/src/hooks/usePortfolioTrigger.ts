/**
 * Hook que observa o cenário (orçamento, escopo, objetivo, alavancas e premissas) e dispara
 * POST /portfolio com debounce de 400ms. Atualiza portfolio, financeiro por município e KPIs.
 */

import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/appStore'

export function usePortfolioTrigger() {
  const budget              = useAppStore((s) => s.budget)
  const levers              = useAppStore((s) => s.levers)
  const params              = useAppStore((s) => s.params)
  const objetivo            = useAppStore((s) => s.objetivo)
  const uf                  = useAppStore((s) => s.filters.uf)
  const regiao              = useAppStore((s) => s.filters.regiao)
  const semiarido           = useAppStore((s) => s.filters.semiarido)
  const nMunicipios         = useAppStore((s) => s.municipios.length)
  const setPortfolioResult  = useAppStore((s) => s.setPortfolioResult)
  const setPortfolioLoading = useAppStore((s) => s.setPortfolioLoading)
  const setError            = useAppStore((s) => s.setError)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Sem municípios carregados ainda — não dispara
    if (nMunicipios === 0) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setPortfolioLoading(true)
      try {
        const result = await api.postPortfolio({
          budget,
          max_payback: 10,
          objetivo,
          params,
          ...(uf ? { uf } : {}),
          ...(regiao ? { regiao } : {}),
          ...(semiarido ? { semiarido } : {}),
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
  }, [budget, levers, params, objetivo, uf, regiao, semiarido, nMunicipios])
}
