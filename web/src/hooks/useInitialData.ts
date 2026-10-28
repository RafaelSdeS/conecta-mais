/**
 * useInitialData — carrega municípios da API ao inicializar.
 * Se a API não estiver disponível, injeta dados simulados para dev.
 */

import { useEffect } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/appStore'
import { generateMockMunicipios } from '../utils/mockData'

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
      .catch(() => {
        // API offline — injeta dados mock para desenvolvimento
        setMunicipios(generateMockMunicipios())
        setError(null) // não exibe erro, é esperado em dev sem backend
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
