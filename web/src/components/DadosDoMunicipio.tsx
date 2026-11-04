/**
 * DadosDoMunicipio — listas para as secretarias e para o planejamento (portal B2G em versão inicial):
 * escolas sem internet (INEP), UBS (CNES) e provedores locais com a leitura construir × comprar (Anatel).
 * Cada lista carrega sob demanda e pode ser baixada em CSV. Não sai no PDF da ficha.
 */

import { useState } from 'react'
import { api, type MercadoMunicipio } from '../api/client'
import { baixaCsv, paraCsv } from '../utils/csv'
import { fmtN0 } from '../utils/format'

type Estado<T> = { carregando: boolean; erro?: string; dados?: T }

const botao: React.CSSProperties = {
  font: 'inherit', fontSize: 12, borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
  background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)',
}

function useCarga<T>(busca: () => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ carregando: false })
  const carrega = () => {
    setEstado({ carregando: true })
    busca()
      .then((dados) => setEstado({ carregando: false, dados }))
      .catch((e: unknown) => setEstado({ carregando: false, erro: e instanceof Error ? e.message : String(e) }))
  }
  return [estado, carrega] as const
}

function Bloco({ titulo, fonte, estado, carrega, children, csv }: {
  titulo: string
  fonte: string
  estado: Estado<unknown>
  carrega: () => void
  children: React.ReactNode
  csv?: () => void
}) {
  return (
    <div style={{ border: '1px solid var(--ln)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{titulo}</b>
        <span style={{ display: 'flex', gap: 6 }}>
          {!estado.dados && (
            <button type="button" style={botao} onClick={carrega} disabled={estado.carregando}>
              {estado.carregando ? 'Carregando…' : 'Carregar'}
            </button>
          )}
          {estado.dados !== undefined && csv && <button type="button" style={botao} onClick={csv}>Baixar CSV</button>}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--mu)', margin: '2px 0 6px' }}>{fonte}</div>
      {estado.erro && <p role="alert" style={{ fontSize: 12, color: 'var(--q2b)', margin: 0 }}>{estado.erro}</p>}
      {estado.dados !== undefined && children}
    </div>
  )
}

const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid var(--ln)', fontSize: 12 }

export default function DadosDoMunicipio({ id, nome, ubsTotal }: { id: string; nome: string; ubsTotal: number }) {
  const [escolas, carregaEscolas] = useCarga(() => api.getEscolasSemInternet(id))
  const [ubs, carregaUbs] = useCarga(() => api.getUbs(id))
  const [mercado, carregaMercado] = useCarga<MercadoMunicipio>(() => api.getProvedores(id))
  const slug = nome.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()

  return (
    <div className="no-print">
      <h3>Para a secretaria e o planejamento</h3>

      <Bloco
        titulo="Escolas sem internet"
        fonte="INEP, Censo Escolar 2024 (IN_INTERNET = 0). Até 100 escolas por consulta."
        estado={escolas}
        carrega={carregaEscolas}
        csv={() =>
          escolas.dados &&
          baixaCsv(
            `escolas-sem-internet-${slug}.csv`,
            paraCsv(escolas.dados.escolas as unknown as Record<string, unknown>[], [
              { chave: 'codigo_inep', titulo: 'Código INEP' },
              { chave: 'escola', titulo: 'Escola' },
              { chave: 'municipio', titulo: 'Município' },
              { chave: 'uf', titulo: 'UF' },
            ]),
          )
        }
      >
        {escolas.dados && (
          <>
            <p style={{ fontSize: 12, margin: '0 0 4px' }}>
              {fmtN0(escolas.dados.total_sem_internet)} escolas sem internet; mostrando {escolas.dados.escolas.length}.
            </p>
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {escolas.dados.escolas.map((e) => (
                    <tr key={e.codigo_inep}><td style={td}>{e.escola}</td><td style={{ ...td, color: 'var(--mu)' }}>{e.codigo_inep}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Bloco>

      <Bloco
        titulo={`Saúde: UBS (${fmtN0(ubsTotal)})`}
        fonte="CNES, API de dados abertos do SUS (Centros de Saúde / UBS habilitadas). Indicador de demanda; não informa a conectividade de cada UBS."
        estado={ubs}
        carrega={carregaUbs}
        csv={() =>
          ubs.dados &&
          baixaCsv(
            `ubs-${slug}.csv`,
            paraCsv(ubs.dados.ubs as unknown as Record<string, unknown>[], [
              { chave: 'codigo_cnes', titulo: 'CNES' },
              { chave: 'nome', titulo: 'UBS' },
              { chave: 'lat', titulo: 'Latitude' },
              { chave: 'lon', titulo: 'Longitude' },
            ]),
          )
        }
      >
        {ubs.dados && (
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {ubs.dados.ubs.map((u) => (
                  <tr key={u.codigo_cnes}><td style={td}>{u.nome || '(sem nome)'}</td><td style={{ ...td, color: 'var(--mu)' }}>{u.codigo_cnes}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Construir × comprar: provedores locais"
        fonte="Anatel, banda larga fixa de pessoa física. Triagem pelos acessos; não considera preço, qualidade da rede nem aspectos jurídicos."
        estado={mercado}
        carrega={carregaMercado}
        csv={() =>
          mercado.dados &&
          baixaCsv(
            `provedores-${slug}.csv`,
            paraCsv(mercado.dados.provedores as unknown as Record<string, unknown>[], [
              { chave: 'empresa', titulo: 'Empresa' },
              { chave: 'grupo', titulo: 'Grupo econômico' },
              { chave: 'porte', titulo: 'Porte' },
              { chave: 'acessos', titulo: 'Acessos' },
              { chave: 'acessos_fibra', titulo: 'Acessos de fibra' },
            ]),
          )
        }
      >
        {mercado.dados && (
          <>
            <p style={{ fontSize: 12, margin: '0 0 4px' }}>
              <b>{mercado.dados.leitura}</b> Fibra cobre {(mercado.dados.penetracao_fibra_total * 100).toFixed(0)}% dos
              domicílios ({(mercado.dados.penetracao_fibra_ppp * 100).toFixed(0)}% por pequenos provedores).
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {mercado.dados.provedores.slice(0, 6).map((p) => (
                  <tr key={p.empresa}>
                    <td style={td}>{p.empresa}</td>
                    <td style={{ ...td, color: 'var(--mu)' }}>{p.porte}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtN0(p.acessos)} ({fmtN0(p.acessos_fibra)} fibra)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Bloco>
    </div>
  )
}
