/** Links e texto do kit de visita (funções puras). */

export const urlMapa = (busca: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`

export const linkTelefone = (telefone: string): string => `tel:+55${telefone.replace(/\D/g, '')}`

export const urlWhatsApp = (texto: string): string => `https://wa.me/?text=${encodeURIComponent(texto)}`

export interface ResumoVisita {
  nome: string
  uf: string
  veredito: string
  explicacao: string
  motivos: string[]
  alerta: string | null
  recomendacao?: string
  link: string
}

/** Texto para mandar por mensagem: a decisão primeiro, os números depois e o link para a ficha. */
export function textoCompartilhar(r: ResumoVisita): string {
  return [
    `${r.nome}/${r.uf}: ${r.veredito}`,
    r.explicacao,
    ...r.motivos.map((motivo) => `- ${motivo}`),
    r.alerta,
    r.recomendacao,
    `Ficha: ${r.link}`,
  ].filter(Boolean).join('\n')
}
