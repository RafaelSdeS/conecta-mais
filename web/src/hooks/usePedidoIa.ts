/**
 * usePedidoIa — estado de um pedido ao IBM Granite guardado na store por chave. O pedido segue se a
 * pessoa trocar de aba ou fechar a ficha; ao voltar, o botão mostra "Gerando…" ou o resultado. Se a
 * resposta chegar com o botão fora da tela, um toast avisa.
 */

import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useToast } from './toastContext'

// Quantos botões de cada chave estão à vista agora (não precisa re-renderizar nada).
const naTela = new Map<string, number>()

export function usePedidoIa(chave: string, aviso: string, visivel = true) {
  const pedido = useAppStore((s) => s.iaPedidos[chave])
  const setIaPedido = useAppStore((s) => s.setIaPedido)
  const { toast } = useToast()

  useEffect(() => {
    if (!visivel) return
    naTela.set(chave, (naTela.get(chave) ?? 0) + 1)
    return () => { naTela.set(chave, (naTela.get(chave) ?? 1) - 1) }
  }, [chave, visivel])

  async function pedir(run: () => Promise<void>) {
    setIaPedido(chave, {})
    try {
      await run()
      setIaPedido(chave, null)
      if (!naTela.get(chave)) toast(aviso, 5000)
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e)
      setIaPedido(chave, { erro })
      if (!naTela.get(chave)) toast(erro, 5000)
    }
  }

  return { gerando: pedido !== undefined && pedido.erro === undefined, erro: pedido?.erro, pedir }
}
