/**
 * useInitialData — carrega municípios da API ao inicializar.
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

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

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

  useEffect(() => {
    setLoading(true)
    api.getQualidade()
      .then((q) => { setFonteDados(q.fonte_dados); setQualidade(q.campos) })
      .catch(() => {})  // sem a API, o erro de /municipios abaixo já avisa o usuário
    api.getMunicipios()
      .then((data) => {
        setMunicipios(data)
        // Link direto: /?m=<código IBGE> abre a ficha; &print=1 deixa a página no modo de impressão da ficha.
        const q = new URLSearchParams(window.location.search)
        // Filtros por URL: ?uf=BA&regiao=Nordeste&semiarido=1&quadrante=Q1
        setFilters({
          uf: q.get('uf')?.toUpperCase() ?? '',
          regiao: q.get('regiao') ?? '',
          semiarido: q.get('semiarido') === '1',
          quadrante: q.get('quadrante') ?? '',
        })
        const aba = q.get('view')
        if (aba && VIEWS.some((v) => v.id === aba)) setView(aba as ViewId)
        const id = q.get('m')
        if (id && data.some((m) => m.id_municipio === id)) {
          openDrawer(id)
          if (q.get('print') === '1') document.body.classList.add('imprimindo-ficha')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
