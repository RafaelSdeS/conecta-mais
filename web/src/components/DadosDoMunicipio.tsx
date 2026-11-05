/**
 * DadosDoMunicipio — kit da visita: escolas sem internet para aprendizagem (INEP), provedores locais com a
 * leitura construir × comprar (Anatel) e UBS (CNES). Escolas e provedores carregam ao abrir a ficha.
 * Cada lista pode ser baixada em CSV. Não sai no PDF da ficha.
 */

import { useEffect, useState } from 'react'
import { api, type EscolaVisita, type MercadoMunicipio } from '../api/client'
import { baixaCsv, paraCsv } from '../utils/csv'
import { fmtN0 } from '../utils/format'
import { linkTelefone, urlMapa } from '../utils/kit'

type Estado<T> = { carregando: boolean; erro?: string; dados?: T }

const ESCOLAS_VISIVEIS = 5

const botao: React.CSSProperties = {
  font: 'inherit', fontSize: 13, borderRadius: 4, padding: '6px 10px', cursor: 'pointer',
  background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)',
}

// Links de ação no celular: alvo de toque de 44 px.
const acao: React.CSSProperties = {
  ...botao, display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'none', fontWeight: 500,
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
        <b style={{ fontSize: 14 }}>{titulo}</b>
        <span style={{ display: 'flex', gap: 6 }}>
          {estado.dados === undefined && (
            <button type="button" style={botao} onClick={carrega} disabled={estado.carregando}>
              {estado.carregando ? 'Carregando…' : estado.erro ? 'Tentar de novo' : 'Carregar'}
            </button>
          )}
          {estado.dados !== undefined && csv && <button type="button" style={botao} onClick={csv}>Baixar CSV</button>}
        </span>
      </div>
      {estado.erro && <p role="alert" style={{ fontSize: 13, color: 'var(--q2b)', margin: '6px 0 0' }}>{estado.erro}</p>}
      {estado.dados !== undefined && children}
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>{fonte}</div>
    </div>
  )
}

function Escola({ e, municipio }: { e: EscolaVisita; municipio: string }) {
  return (
    <li style={{ padding: '8px 0', borderTop: '1px solid var(--ln)' }}>
      <b style={{ fontSize: 14 }}>{e.escola}</b>
      <div style={{ fontSize: 13, color: 'var(--mu)' }}>{e.rede} · {e.zona} · {fmtN0(e.alunos)} alunos</div>
      {e.endereco && <div style={{ fontSize: 13 }}>{e.endereco}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {e.telefone && <a style={acao} href={linkTelefone(e.telefone)}>Ligar {e.telefone}</a>}
        <a style={acao} href={urlMapa(`${e.escola}, ${e.endereco}, ${municipio}`)} target="_blank" rel="noreferrer">Abrir no mapa</a>
      </div>
    </li>
  )
}

const td: React.CSSProperties = { padding: '6px', borderBottom: '1px solid var(--ln)', fontSize: 13 }

export default function DadosDoMunicipio({ id, nome, uf, ubsTotal }: { id: string; nome: string; uf: string; ubsTotal: number }) {
  const [escolas, carregaEscolas] = useCarga(() => api.getEscolasVisita(id))
  const [ubs, carregaUbs] = useCarga(() => api.getUbs(id))
  const [mercado, carregaMercado] = useCarga<MercadoMunicipio>(() => api.getProvedores(id))
  const slug = nome.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
  const municipio = `${nome}, ${uf}`

  // A ficha é recriada a cada município (key), então isto roda uma vez por município aberto.
  useEffect(() => {
    carregaEscolas()
    carregaMercado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="no-print">
      <h3>Kit da visita</h3>

      <Bloco
        titulo="Escolas sem internet para aprendizagem"
        fonte="INEP, Censo Escolar 2024. Contatos publicados pelo INEP; use só para falar com a escola. Sem coordenadas: o mapa busca pelo endereço."
        estado={escolas}
        carrega={carregaEscolas}
        csv={() =>
          escolas.dados &&
          baixaCsv(
            `escolas-sem-internet-${slug}.csv`,
            paraCsv(escolas.dados.escolas as unknown as Record<string, unknown>[], [
              { chave: 'codigo_inep', titulo: 'Código INEP' },
              { chave: 'escola', titulo: 'Escola' },
              { chave: 'rede', titulo: 'Rede' },
              { chave: 'zona', titulo: 'Zona' },
              { chave: 'alunos', titulo: 'Alunos' },
              { chave: 'endereco', titulo: 'Endereço' },
              { chave: 'telefone', titulo: 'Telefone' },
            ]),
          )
        }
      >
        {escolas.dados && (
          <>
            <p style={{ fontSize: 13, margin: '6px 0 4px' }}>
              {escolas.dados.total === 0
                ? 'Nenhuma escola sem internet para aprendizagem neste município.'
                : `${fmtN0(escolas.dados.total)} escolas, da que tem mais alunos para a que tem menos.`}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {escolas.dados.escolas.slice(0, ESCOLAS_VISIVEIS).map((e) => <Escola key={e.codigo_inep} e={e} municipio={municipio} />)}
            </ul>
            {escolas.dados.escolas.length > ESCOLAS_VISIVEIS && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 14, padding: '12px 0' }}>
                  Ver mais {escolas.dados.escolas.length - ESCOLAS_VISIVEIS} escolas
                  {escolas.dados.total > escolas.dados.escolas.length && ` (o CSV também vai até ${escolas.dados.escolas.length})`}
                </summary>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {escolas.dados.escolas.slice(ESCOLAS_VISIVEIS).map((e) => <Escola key={e.codigo_inep} e={e} municipio={municipio} />)}
                </ul>
              </details>
            )}
          </>
        )}
      </Bloco>

      <Bloco
        titulo="Provedores locais: construir ou comprar?"
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
            <p style={{ fontSize: 13, margin: '6px 0 4px' }}>
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
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {ubs.dados.ubs.map((u) => (
                  <tr key={u.codigo_cnes}>
                    <td style={td}>{u.nome || '(sem nome)'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {u.lat != null && u.lon != null && (
                        <a href={urlMapa(`${u.lat},${u.lon}`)} target="_blank" rel="noreferrer">Mapa</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  )
}
