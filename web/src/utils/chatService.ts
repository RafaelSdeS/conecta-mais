/** Cliente do chat FastAPI; o navegador nunca acessa watsonx.ai diretamente. */

export type ChatRole = 'user' | 'assistant'

export interface ChatHistoryMessage {
  role: ChatRole
  content: string
}

export type ChatSourceId = 'sqlite_integrado' | 'engine' | 'engine_mock' | 'rag_tecnico'

export interface ChatDataSource {
  id: ChatSourceId
  tipo: 'real' | 'demonstrativo' | 'documental'
  descricao: string
}

export interface ChatToolExecution {
  name: string
  status: 'success' | 'not_found' | 'failed' | 'cached'
}

export interface RagReference {
  title: string
  sourcePath: string
  section: string
  lines: string
  documentType?: string
  isOfficial?: boolean
}

export interface ChatAnswer {
  text: string
  history: ChatHistoryMessage[]
  sources: ChatDataSource[]
  toolsExecuted: ChatToolExecution[]
  hasDemoData: boolean
  references: RagReference[]
}

interface ChatApiResponse {
  response?: unknown
  history?: unknown
  data_sources?: unknown
  tools_executed?: unknown
  has_demo_data?: unknown
  references?: unknown
  error?: {
    code?: unknown
    message?: unknown
  } | null
}

export class ChatServiceError extends Error {
  readonly status?: number
  readonly code?: string
  readonly partialResponse?: string
  readonly dataSources: ChatDataSource[]
  readonly hasDemoData: boolean

  constructor(
    message: string,
    status?: number,
    code?: string,
    partialResponse?: string,
    dataSources: ChatDataSource[] = [],
    hasDemoData = false,
  ) {
    super(message)
    this.name = 'ChatServiceError'
    this.status = status
    this.code = code
    this.partialResponse = partialResponse
    this.dataSources = dataSources
    this.hasDemoData = hasDemoData
  }
}

const CHAT_ENDPOINT = '/api/chat'
const MAX_HISTORY_MESSAGES = 12
const RAG_CITATION =
  /\(fonte:\s*([^,\n()]+),\s*((?:docs|engine)\/[^,\n()]+),\s*seção\s*([^,\n()]+),\s*linhas\s*(\d+[–-]\d+)\)/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSources(value: unknown): ChatDataSource[] {
  if (!Array.isArray(value)) return []
  return value.filter((source): source is ChatDataSource => {
    if (!isRecord(source)) return false
    return (
      (source.id === 'sqlite_integrado' ||
        source.id === 'engine' ||
        source.id === 'engine_mock' ||
        source.id === 'rag_tecnico') &&
      (source.tipo === 'real' ||
        source.tipo === 'demonstrativo' ||
        source.tipo === 'documental') &&
      typeof source.descricao === 'string'
    )
  })
}

function parseHistory(value: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (message): message is ChatHistoryMessage =>
        isRecord(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    )
    .slice(-MAX_HISTORY_MESSAGES)
}

function parseTools(value: unknown): ChatToolExecution[] {
  if (!Array.isArray(value)) return []
  return value.filter((tool): tool is ChatToolExecution => {
    if (!isRecord(tool)) return false
    return (
      typeof tool.name === 'string' &&
      (tool.status === 'success' ||
        tool.status === 'not_found' ||
        tool.status === 'failed' ||
        tool.status === 'cached')
    )
  })
}

function parseReferences(text: string, value: unknown): {
  text: string
  references: RagReference[]
} {
  const inlineReferences: RagReference[] = []
  const cleanText = text.replace(
    RAG_CITATION,
    (_citation, title: string, sourcePath: string, section: string, lines: string) => {
      inlineReferences.push({ title, sourcePath, section, lines })
      return ''
    },
  )

  const references: RagReference[] = []
  if (Array.isArray(value)) {
    for (const reference of value) {
      if (
        !isRecord(reference) ||
        typeof reference.title !== 'string' ||
        typeof reference.source_path !== 'string' ||
        typeof reference.section !== 'string' ||
        !Number.isInteger(reference.line_start) ||
        !Number.isInteger(reference.line_end) ||
        typeof reference.document_type !== 'string' ||
        typeof reference.is_official !== 'boolean'
      ) {
        continue
      }

      references.push({
        title: reference.title,
        sourcePath: reference.source_path,
        section: reference.section,
        lines: `${reference.line_start}–${reference.line_end}`,
        documentType: reference.document_type,
        isOfficial: reference.is_official,
      })
    }
  }

  const uniqueReferences = references.filter(
    (reference, index, allReferences) =>
      allReferences.findIndex(
        (candidate) =>
          candidate.sourcePath === reference.sourcePath &&
          candidate.section === reference.section &&
          candidate.lines === reference.lines,
      ) === index,
  )

  return {
    text: cleanText.replace(/[ \t]+\n/g, '\n').trim(),
    references: uniqueReferences.length > 0 ? uniqueReferences : inlineReferences,
  }
}

function errorMessage(status: number, code: string | undefined): string {
  if (status === 503 && code === 'watsonx_not_configured') {
    return 'O chat não está configurado no backend. Contate o responsável pelo serviço.'
  }
  if (status === 502 && code === 'watsonx_incomplete_response') {
    return 'O Granite interrompeu a resposta antes de concluí-la. Tente novamente mais tarde.'
  }
  if (status === 504 || code === 'watsonx_timeout') {
    return 'O backend excedeu o tempo limite ao consultar o assistente.'
  }
  return `Não foi possível obter uma resposta do backend${status ? ` (HTTP ${status})` : ''}.`
}

/**
 * Envia a pergunta e até 12 mensagens anteriores compatíveis com o FastAPI.
 * O Vite reescreve /api/chat para /chat no backend local.
 */
export interface ChatContext {
  municipio_id?: string
  municipio_nome?: string
  orcamento_mi?: number
  quadrante?: string
  busca?: string
}

export async function getAnswer(
  question: string,
  history: ChatHistoryMessage[],
  context?: ChatContext,
): Promise<ChatAnswer> {
  let response: Response
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        history: history.slice(-MAX_HISTORY_MESSAGES),
        ...(context ? { context } : {}),
      }),
    })
  } catch {
    throw new ChatServiceError(
      'Não foi possível conectar ao backend Conecta+. Verifique se a API está em execução.',
    )
  }

  let body: ChatApiResponse
  try {
    const parsed: unknown = await response.json()
    if (!isRecord(parsed)) throw new Error('Invalid response')
    body = parsed as ChatApiResponse
  } catch {
    throw new ChatServiceError(
      `O backend retornou uma resposta inválida (HTTP ${response.status}).`,
      response.status,
    )
  }

  const sources = parseSources(body.data_sources)
  const toolsExecuted = parseTools(body.tools_executed)
  const hasDemoData =
    body.has_demo_data === true ||
    sources.some((source) => source.id === 'engine_mock')
  const partialResponse =
    typeof body.response === 'string' ? body.response : undefined
  const errorCode =
    isRecord(body.error) && typeof body.error.code === 'string'
      ? body.error.code
      : undefined

  if (!response.ok || body.error) {
    const backendMessage =
      isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : errorMessage(response.status, errorCode)
    throw new ChatServiceError(
      backendMessage || errorMessage(response.status, errorCode),
      response.status,
      errorCode,
      partialResponse,
      sources,
      hasDemoData,
    )
  }

  if (!partialResponse?.trim()) {
    throw new ChatServiceError(
      'O backend não retornou uma resposta textual.',
      response.status,
      undefined,
      undefined,
      sources,
      hasDemoData,
    )
  }

  const { text, references } = parseReferences(
    partialResponse,
    body.references,
  )
  return {
    text,
    history: parseHistory(body.history),
    sources,
    toolsExecuted,
    hasDemoData,
    references,
  }
}
