/**
 * useInitialData — carrega municípios da API ao inicializar e mantém o cenário na URL.
 *
 * Em desenvolvimento (localhost): se a API não responder, injeta dados simulados
 * silenciosamente para permitir trabalhar sem o back rodando.
 * Em produção: expõe o erro para o usuário, sem injetar dados falsos.
 */

import { useEffect } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/appStore'
import { generateMockMunicipios } from '../utils/mockData'
import { VIEWS, type ViewId } from '../utils/constants'
import { cenarioDaUrl, cenarioParaUrl } from '../utils/url'

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
// Lida uma vez, ao carregar o módulo: a URL passa a ser reescrita a cada mudança de cenário, e o
// StrictMode roda o efeito duas vezes; ler aqui garante que nada se perde antes de ser aplicado.
const URL_INICIAL = window.location.search

export function useInitialData() {
  const setMunicipios = useAppStore((s) => s.setMunicipios)
  const setLoading    = useAppStore((s) => s.setLoading)
  const setError      = useAppStore((s) => s.setError)
  const setFonteDados = useAppStore((s) => s.setFonteDados)
  const setQualidade  = useAppStore((s) => s.setQualidade)
  const setApiOffline  = useAppStore((s) => s.setApiOffline)
  const openDrawer    = useAppStore((s) => s.openDrawer)
  const setFilters    = useAppStore((s) => s.setFilters)
  const setView       = useAppStore((s) => s.setView)
  const setDecisoes   = useAppStore((s) => s.setDecisoes)

  useEffect(() => {
    // Cenário por URL: ?uf=BA&regiao=Nordeste&semiarido=1&quadrante=Q1&orcamento=150&objetivo=alunos
    // &alavancas=fust,enec&view=chat
    const daUrl = cenarioDaUrl(URL_INICIAL)
    const st = useAppStore.getState()
    if (daUrl.budget != null) st.setBudget(daUrl.budget)
    if (daUrl.objetivo) st.setObjetivo(daUrl.objetivo)
    if (daUrl.levers) st.setLevers(daUrl.levers)
    setFilters(daUrl.filters)
    if (daUrl.view && VIEWS.some((v) => v.id === daUrl.view)) setView(daUrl.view as ViewId)

    // A partir daqui, cada mudança de cenário, aba ou ficha reescreve a URL (sem nova entrada no histórico).
    const pararDeEscrever = useAppStore.subscribe((s) => {
      const nova = cenarioParaUrl({
        budget: s.budget, objetivo: s.objetivo, levers: s.levers, filters: s.filters, view: s.view,
        ficha: s.drawerOpen ? s.selectedId : null,
      }, window.location.search)
      if (nova !== window.location.search) {
        window.history.replaceState(null, '', window.location.pathname + nova + window.location.hash)
      }
    })

    setLoading(true)
    api.getQualidade()
      .then((q) => { setFonteDados(q.fonte_dados); setQualidade(q.campos) })
      .catch(() => {})  // sem a API, o erro de /municipios abaixo já avisa o usuário
    api.getDecisoes().then(setDecisoes).catch(() => {})
    api.getMunicipios()
      .then((data) => {
        setMunicipios(data)
        // Link direto: /?m=<código IBGE> abre a ficha; &print=1 deixa a página no modo de impressão da ficha.
        const id = daUrl.ficha
        if (id && data.some((m) => m.id_municipio === id)) {
          openDrawer(id)
          if (new URLSearchParams(URL_INICIAL).get('print') === '1') document.body.classList.add('imprimindo-ficha')
        }
      })
      .catch((err: unknown) => {
        if (IS_DEV) {
          // Dev sem back rodando — injeta mock silenciosamente
          setMunicipios(generateMockMunicipios())
          setFonteDados('mock')
          setApiOffline(true)
          setError(null)
        } else {
          // Produção — expõe erro para o usuário
          setError(`Não foi possível carregar os dados: ${String(err)}`)
        }
      })
      .finally(() => setLoading(false))
    return pararDeEscrever
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
