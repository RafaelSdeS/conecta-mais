/** Regiões do Brasil pelo primeiro dígito do código IBGE do município. */

export const REGIOES = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'] as const
export type Regiao = typeof REGIOES[number]

export const REGIAO_POR_DIGITO: Record<string, Regiao> = {
  '1': 'Norte', '2': 'Nordeste', '3': 'Sudeste', '4': 'Sul', '5': 'Centro-Oeste',
}

export const regiaoDe = (idMunicipio: string): Regiao | undefined => REGIAO_POR_DIGITO[idMunicipio[0]]
