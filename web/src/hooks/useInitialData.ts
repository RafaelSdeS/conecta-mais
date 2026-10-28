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

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

export function useInitialData() {
  const setMunicipios = useAppStore((s) => s.setMunicipios)
  const setLoading    = useAppStore((s) => s.setLoading)
  const setError      = useAppStore((s) => s.setError)

  useEffect(() => {
    setLoading(true)
    api.getMunicipios()
      .then((data) => {
        setMunicipios(data)
      })
      .catch((err: unknown) => {
        if (IS_DEV) {
          // Dev sem back rodando — injeta mock silenciosamente
          setMunicipios(generateMockMunicipios())
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
