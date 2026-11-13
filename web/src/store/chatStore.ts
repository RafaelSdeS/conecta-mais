/**
 * Conversa com o agente, fora da tela do Agente: a resposta continua chegando e fica guardada
 * enquanto a gestora navega pelo app. Fica no sessionStorage, então sobrevive a recarregar a aba,
 * mas não de um dia para o outro, quando o contexto da tela já mudou.
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Acao } from '../api/client'
import {
  ChatServiceError,
  getAnswer,
  type ChatDataSource,
  type ChatHistoryMessage,
  type RagReference,
} from '../utils/chatService'
import { useAppStore } from './appStore'

export interface Message {
  id:        number
  role:      'user' | 'agent'
  text:      string
  sources?:  ChatDataSource[]
  references?: RagReference[]
  hasDemoData?: boolean
  error?:    string
  isTyping?: boolean
  actions?:  Acao[]
}

let nextId = 1

const BOAS_VINDAS: Message = {
  id: 0,
  role: 'agent',
  text: 'Pergunte por rankings de municípios, portfólio para um orçamento, comparação entre cidades, escolas sem internet ou o significado dos scores e quadrantes.',
}

interface ChatState {
  messages: Message[]
  history: ChatHistoryMessage[]
  loading: boolean
  /** Chegou resposta enquanto a gestora estava em outra tela. */
  naoLida: boolean
  enviar: (pergunta: string) => Promise<void>
  marcarLida: () => void
  limpar: () => void
}

export const useChatStore = create<ChatState>()(persist((set, get) => ({
  messages: [BOAS_VINDAS],
  history: [],
  loading: false,
  naoLida: false,

  marcarLida: () => set({ naoLida: false }),
  limpar: () => set({ messages: [BOAS_VINDAS], history: [], naoLida: false }),

  async enviar(pergunta) {
    const q = pergunta.trim()
    if (!q || get().loading) return

    const digitando = nextId + 1
    set((s) => ({
      loading: true,
      messages: [
        ...s.messages,
        { id: nextId++, role: 'user', text: q },
        { id: nextId++, role: 'agent', text: '', isTyping: true },
      ],
    }))
    const responder = (m: Partial<Message>) =>
      set((s) => ({
        loading: false,
        naoLida: useAppStore.getState().view !== 'chat',
        messages: s.messages.map((x) => (x.id === digitando ? { ...x, isTyping: false, ...m } : x)),
      }))

    // Contexto da tela no momento da pergunta (município aberto, orçamento, recorte e cenário).
    const { selectedId, municipios, budget, filters, levers, params, objetivo } = useAppStore.getState()
    const selecionado = municipios.find((m) => m.id_municipio === selectedId)
    try {
      const answer = await getAnswer(q, get().history, {
        ...(selecionado ? { municipio_id: selecionado.id_municipio, municipio_nome: selecionado.nome } : {}),
        orcamento_mi: budget,
        ...(filters.quadrante ? { quadrante: filters.quadrante } : {}),
        ...(filters.search ? { busca: filters.search } : {}),
        ...(filters.uf ? { uf: filters.uf } : {}),
        ...(filters.regiao ? { regiao: filters.regiao } : {}),
        ...(filters.semiarido ? { semiarido: true } : {}),
        objetivo,
        alavancas: {
          backhaul_comprometido: levers.tcu,
          fust_reembolsavel:     levers.fust,
          receita_escolar:       levers.enec,
        },
        premissas: { ...params },
      })
      set({ history: answer.history })
      responder({
        text: answer.text,
        sources: answer.sources,
        references: answer.references,
        hasDemoData: answer.hasDemoData,
        actions: answer.actions,
      })
    } catch (error) {
      const e = error instanceof ChatServiceError
        ? error
        : new ChatServiceError('Não foi possível obter resposta do backend Conecta+.')
      responder({
        text: e.partialResponse ?? '',
        sources: e.dataSources,
        hasDemoData: e.hasDemoData,
        error: e.message,
      })
    }
  },
}), {
  name: 'conecta-chat',
  storage: createJSONStorage(() => sessionStorage),
  // Só a conversa; uma resposta que ainda estava a caminho não volta depois de recarregar.
  partialize: (s) => ({
    history: s.history,
    messages: s.messages.map((m) => (m.isTyping
      ? { ...m, isTyping: false, error: 'Resposta interrompida ao recarregar a página.' }
      : m)),
  }),
  onRehydrateStorage: () => (s) => {
    if (s) nextId = Math.max(nextId, ...s.messages.map((m) => m.id + 1))
  },
}))
