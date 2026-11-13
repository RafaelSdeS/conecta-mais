import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = await readFile(
  new URL('../src/utils/chatService.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const serviceUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { ChatServiceError, getAnswer } = await import(serviceUrl)
const messageSource = await readFile(
  new URL('../src/components/ChatMessage.tsx', import.meta.url),
  'utf8',
)
const messageOutput = ts.transpileModule(messageSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText.replaceAll(
  '"react/jsx-runtime"',
  JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href),
)
const messageUrl = `data:text/javascript;base64,${Buffer.from(messageOutput).toString('base64')}`
const { default: ChatMessage } = await import(messageUrl)

function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('posts a simple question to the Vite API proxy', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return mockResponse({
      response: 'Sou o assistente Conecta+.',
      history: [
        { role: 'user', content: 'Quem é você?' },
        { role: 'assistant', content: 'Sou o assistente Conecta+.' },
      ],
      data_sources: [],
      tools_executed: [],
      has_demo_data: false,
      error: null,
    })
  }

  const result = await getAnswer('Quem é você?', [])

  assert.equal(request.url, '/api/chat')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(request.options.body), {
    message: 'Quem é você?',
    history: [],
  })
  assert.equal(result.text, 'Sou o assistente Conecta+.')
})

test('retains the real data source and the backend conversation history', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () =>
    mockResponse({
      response: 'O SQLite registra 12 escolas sem internet.',
      history: [
        { role: 'user', content: 'Pergunta anterior' },
        { role: 'assistant', content: 'Resposta anterior' },
        { role: 'user', content: 'Quantas estão sem internet?' },
        { role: 'assistant', content: 'O SQLite registra 12 escolas sem internet.' },
      ],
      data_sources: [
        {
          id: 'sqlite_integrado',
          tipo: 'real',
          descricao: 'Dados escolares reais integrados.',
        },
      ],
      tools_executed: [{ name: 'listar_escolas_sem_internet', status: 'success' }],
      has_demo_data: false,
      error: null,
    })

  const result = await getAnswer('Quantas estão sem internet?', [])
  assert.equal(result.sources[0].id, 'sqlite_integrado')
  assert.equal(result.toolsExecuted[0].status, 'success')
  assert.equal(result.history.length, 4)
})

test('identifies demonstrative score results', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () =>
    mockResponse({
      response: 'Score total demonstrativo: 41,33.',
      history: [],
      data_sources: [
        {
          id: 'engine_mock',
          tipo: 'demonstrativo',
          descricao: 'Motor sobre dados demonstrativos.',
        },
      ],
      tools_executed: [{ name: 'consultar_scores_municipio', status: 'success' }],
      has_demo_data: false,
      error: null,
    })

  const result = await getAnswer('Qual o score?', [])
  assert.equal(result.hasDemoData, true)
  assert.equal(result.sources[0].tipo, 'demonstrativo')
})

test('extracts RAG references while retaining their source location', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () =>
    mockResponse({
      response:
        'A dimensão M significa Mercado. (fonte: Referência técnica, docs/engine-technical-reference.md, seção Scores, linhas 20–24).',
      history: [],
      data_sources: [
        {
          id: 'rag_tecnico',
          tipo: 'documental',
          descricao: 'Documentação interna, não oficial.',
        },
      ],
      tools_executed: [{ name: 'consultar_documentacao_conecta', status: 'success' }],
      has_demo_data: false,
      references: [
        {
          title: 'Implementação dos scores',
          source_path: 'engine/conecta/scores/calculator.py',
          section: '_score_A',
          line_start: 141,
          line_end: 155,
          document_type: 'implementation_code',
          is_official: false,
        },
      ],
      error: null,
    })

  const result = await getAnswer('O que significa M?', [])
  assert.match(result.text, /M significa Mercado/)
  assert.deepEqual(result.references, [{
    title: 'Implementação dos scores',
    sourcePath: 'engine/conecta/scores/calculator.py',
    section: '_score_A',
    lines: '141–155',
    documentType: 'implementation_code',
    isOfficial: false,
  }])
})

test('keeps reference list empty when the backend has no sources', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () =>
    mockResponse({
      response: 'Resposta geral.',
      history: [],
      data_sources: [],
      tools_executed: [],
      has_demo_data: false,
      references: [],
      error: null,
    })

  const result = await getAnswer('Pergunta geral', [])
  assert.deepEqual(result.sources, [])
  assert.deepEqual(result.references, [])
})

test('sends only the latest 12 conversation messages', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  let sentHistory
  globalThis.fetch = async (_url, options) => {
    sentHistory = JSON.parse(options.body).history
    return mockResponse({
      response: 'Resposta.',
      history: [],
      data_sources: [],
      tools_executed: [],
      has_demo_data: false,
      error: null,
    })
  }

  const history = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Mensagem ${index}`,
  }))
  await getAnswer('Nova pergunta', history)
  assert.equal(sentHistory.length, 12)
  assert.equal(sentHistory[0].content, 'Mensagem 2')
  assert.equal(sentHistory[11].content, 'Mensagem 13')
})

test('surfaces HTTP failures and keeps partial output marked as an error', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () =>
    mockResponse(
      {
        response: 'Texto interrompido',
        history: [],
        data_sources: [],
        tools_executed: [],
        has_demo_data: false,
        error: {
          code: 'watsonx_incomplete_response',
          message: 'Resposta incompleta.',
        },
      },
      502,
    )

  await assert.rejects(
    getAnswer('Pergunta', []),
    (error) =>
      error instanceof ChatServiceError &&
      error.status === 502 &&
      error.code === 'watsonx_incomplete_response' &&
      error.partialResponse === 'Texto interrompido' &&
      error.message === 'Resposta incompleta.',
  )
})

test('surfaces network failures without generating a fallback answer', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () => {
    throw new TypeError('network failure')
  }

  await assert.rejects(
    getAnswer('Pergunta', []),
    (error) =>
      error instanceof ChatServiceError &&
      error.status === undefined &&
      error.partialResponse === undefined &&
      /Verifique se a API está em execução/.test(error.message),
  )
})

test('renders loading, source attribution, demo warning, and safe message text', () => {
  const loadingMarkup = renderToStaticMarkup(
    createElement(ChatMessage, {
      role: 'agent',
      text: '',
      isTyping: true,
    }),
  )
  assert.match(loadingMarkup, /typing-dot/)

  const markup = renderToStaticMarkup(
    createElement(ChatMessage, {
      role: 'agent',
      text: '<img src=x onerror=alert(1)> **Score demonstrativo**',
      sources: [
        {
          id: 'engine_mock',
          tipo: 'demonstrativo',
          descricao: 'Resultado sobre dados demonstrativos.',
        },
        {
          id: 'rag_tecnico',
          tipo: 'documental',
          descricao: 'Documentação interna.',
        },
      ],
      references: [
        {
          title: 'Referência técnica',
          sourcePath: 'docs/engine-technical-reference.md',
          section: 'Scores',
          lines: '20–24',
        },
      ],
      hasDemoData: true,
    }),
  )
  assert.match(markup, /&lt;img/)
  assert.doesNotMatch(markup, /<img/)
  assert.match(markup, /Resultado demonstrativo/)
  assert.match(markup, /Documentação interna/)
  assert.match(markup, /Referência técnica/)
  assert.match(markup, /linhas 20–24/)
  assert.match(markup, /fonte interna, não oficial/)
})

test('does not render a references section when no reference metadata exists', () => {
  const markup = renderToStaticMarkup(
    createElement(ChatMessage, {
      role: 'agent',
      text: 'Resposta sem fonte documental.',
    }),
  )

  assert.doesNotMatch(markup, /Referências documentais/)
})

test('keeps valid panel actions from the backend and drops malformed ones', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  const aplicar = {
    tipo: 'aplicar_cenario',
    rotulo: 'R$ 120 mi · BA · Semiárido · objetivo Alunos · sem alavancas',
    orcamento_mi: 120,
    objetivo: 'alunos',
    uf: 'BA',
    regiao: '',
    semiarido: true,
    alavancas: { backhaul_comprometido: false, fust_reembolsavel: false, receita_escolar: false },
    id_municipio: null,
  }
  globalThis.fetch = async () =>
    mockResponse({
      response: 'Com R$ 120 mi o plano atende a meta.',
      history: [],
      data_sources: [],
      tools_executed: [{ name: 'orcamento_minimo_para_meta', status: 'success' }],
      has_demo_data: false,
      acoes: [aplicar, { tipo: 'apagar_tudo', rotulo: 'x' }, { tipo: 'aplicar_cenario', rotulo: '' }, 'texto'],
      error: null,
    })

  const result = await getAnswer('Menor orçamento para 5 mil alunos?', [])
  assert.deepEqual(result.actions, [aplicar])
})
