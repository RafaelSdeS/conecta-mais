/** Aplica uma ação de um clique (chat ou achados) ao estado da tela. */

import type { Acao } from '../api/client'
import { useAppStore } from '../store/appStore'

export function aplicarAcao(a: Acao) {
  const s = useAppStore.getState()
  if (a.tipo === 'abrir_municipio') {
    if (a.id_municipio) s.openDrawer(a.id_municipio)
    return
  }
  if (a.orcamento_mi != null) s.setBudget(a.orcamento_mi)
  if (a.objetivo != null) s.setObjetivo(a.objetivo)
  if (a.alavancas != null) {
    s.setLevers({
      tcu: a.alavancas.backhaul_comprometido,
      fust: a.alavancas.fust_reembolsavel,
      enec: a.alavancas.receita_escolar,
    })
  }
  s.setFilters({
    ...(a.uf != null ? { uf: a.uf } : {}),
    ...(a.regiao != null ? { regiao: a.regiao } : {}),
    ...(a.semiarido != null ? { semiarido: a.semiarido } : {}),
  })
  s.setView('painel')
}
