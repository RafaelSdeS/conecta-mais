# Conecta+ — Plano de Implementação do Frontend (Joel)

## Visão Geral

Migrar o protótipo `FRONT/painel.html` para uma aplicação React completa dentro de
`github/conecta-mais/web/`, aproveitando a estrutura Vite + Tailwind CSS v4 que Rafael
já configurou. O resultado deve ser fiel ao protótipo visual, integrado com a API
FastAPI do Rafael e preparado para receber os agentes de IA do Chris.

**Stack:**
- React 19 + TypeScript + Vite 8 (já instalados)
- Tailwind CSS v4 (já instalado)
- shadcn/ui (a instalar — base dos componentes do 21st.dev)
- Zustand (a instalar — estado global)
- @react-google-maps/api + @googlemaps/markerclusterer (a instalar — mapa)
- Recharts (a instalar — histograma de payback)
- lucide-react (a instalar — ícones)

**Fonte de verdade visual:** `FRONT/painel.html`
**API:** FastAPI em `engine/api/` (porta 8000, proxy `/api` já configurado no Vite)

---

## Sub-Tarefas

---

### ST-1 — Fundação: dependências, tokens CSS, estado global e layout raiz

**Status:** `[x] done`

**Intent:**
Instalar todas as dependências novas, atualizar o `index.css` com os tokens de design
completos (light + dark), inicializar o shadcn/ui, criar a store Zustand e refatorar o
`App.tsx` para o layout final de 4 views com sidebar + header.

**Expected Outcomes:**
- `npm install` sem erros com todas as dependências novas
- `index.css` com todas as CSS custom properties do protótipo (light e dark theme)
- Store Zustand em `src/store/appStore.ts` tipada e funcionando
- `App.tsx` renderiza sidebar + header vazio + área de conteúdo com 4 views (placeholder)
- `npm run dev` abre o app sem erros no console

**Todo List:**
1. Instalar dependências:
   - `zustand`
   - `@react-google-maps/api`
   - `@googlemaps/markerclusterer`
   - `recharts`
   - `lucide-react`
   - shadcn/ui CLI + componentes base (`button`, `input`, `slider`, `checkbox`, `drawer`, `badge`, `dialog`)
2. Atualizar `src/index.css`:
   - Adicionar tokens light: `--bg`, `--pn`, `--ln`, `--tx`, `--mu`, `--so`, `--ac`, `--on`, `--land`
   - Adicionar tokens de quadrante: `--q1`, `--q2a`, `--q2b`, `--q3`, `--q4`
   - Adicionar tokens de status: `--bad`, `--ok`
   - Adicionar dark theme via `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`
   - Adicionar `@keyframes` para shimmer, bounce-dot e toast
3. Criar `src/store/appStore.ts`:
   - Campos: `budget`, `levers` (fust/tcu/enec), `layers` (backhaul/schools/mobile/selected)
   - Campos: `filters` (search/quadrante/portfolio_only/favorites_only), `sort` (key/dir)
   - Campos: `municipios`, `portfolio`, `kpis`, `selectedId`
   - Campos: `drawerOpen`, `cmdPaletteOpen`, `theme`
   - Actions: `setBudget`, `setLevers`, `setLayers`, `setFilters`, `setSort`, `setTheme`
   - Actions: `setMunicipios`, `setPortfolio`, `setKpis`, `openDrawer`, `closeDrawer`
4. Criar `src/utils/format.ts`: `fmtMi`, `fmtAnos`, `fmtN0` (números com separador)
5. Criar `src/utils/constants.ts`: `QUADRANT_NAMES`, `QUADRANT_COLORS`, `AGENT_DESCRIPTIONS`
6. Refatorar `src/App.tsx`:
   - Grid: `208px sidebar + 1fr main`
   - Sidebar com brand, nav (4 botões), nota de rodapé
   - Header (sticky) vazio por enquanto
   - Área `<main>` com switch entre 4 views (Painel, Municípios, Agente, Solução)
   - Componentes de overlay: `<Drawer />`, `<CommandPalette />`, `<Toast />`

**Relevant Context:**
- `FRONT/painel.html` linhas 16-104: tokens CSS completos (light + dark)
- `github/conecta-mais/web/src/index.css`: base já existe, estender
- `github/conecta-mais/web/src/App.tsx`: refatorar (layout atual tem apenas 2 views)
- `github/conecta-mais/web/package.json`: dependências atuais

---

### ST-2 — Header: orçamento, alavancas e paleta de comandos (botão)

**Status:** `[x] done`

**Intent:**
Criar o componente `Header` com o slider de orçamento, os 3 toggles de alavanca e
o botão "Buscar Ctrl+K". Cada mudança dispara um POST `/portfolio` e atualiza a store.

**Expected Outcomes:**
- Slider de orçamento (R$ 5–150 mi) atualiza `budget` na store ao soltar o drag
- Checkboxes FUST/BNDES, Acordo TCU e Receita ENEC atualizam `levers` na store
- Botão "Ligar alavancas" / "Desligar alavancas" alterna todos os 3 de uma vez
- Botão "Aplicar cenário completo" → budget=80 + todas as alavancas ON
- Botão "Buscar Ctrl+K" abre a paleta (store.cmdPaletteOpen = true)
- No mobile (<900px): controles ficam atrás de um botão "☰ Filtros" expansível
- Toast de feedback ao alternar uma alavanca: "FUST ligada — X municípios viáveis"

**Todo List:**
1. Criar `src/components/Header.tsx`:
   - Conectar ao store: `budget`, `levers`, `municipios` (para contar viáveis)
   - shadcn/ui `<Slider>` para orçamento com `<output>` formatado em R$ mi
   - shadcn/ui `<Checkbox>` para cada alavanca (label com `title` tooltip)
   - Botão toggle all (`btnAll`)
   - Botão "Aplicar cenário completo" com shimmer animation
   - Botão "Buscar" para paleta
   - Responsivo: `<Collapsible>` do shadcn/ui para mobile
2. Criar `src/hooks/usePortfolioTrigger.ts`:
   - `useEffect` que observa `budget` + `levers` na store
   - Debounce de 300ms para não disparar a cada tick do slider
   - Chama `POST /portfolio` e atualiza `store.setPortfolio` + `store.setKpis`
3. Criar `src/hooks/useToast.ts`:
   - Gerencia fila de toasts (array com id + message)
   - `toast(message, duration?)` para adicionar
   - Auto-remove após duração
4. Criar `src/components/Toast.tsx`:
   - Renderiza o toast atual (bottom center, animado)
   - Lê do hook `useToast`

**Relevant Context:**
- `FRONT/painel.html` linhas 35-50: CSS do header `.top`
- `FRONT/painel.html` linhas 139-149: HTML dos controles
- `FRONT/painel.html` linhas 449-461: eventos do header (simulate, toast, rec)
- `github/conecta-mais/web/src/api/client.ts`: `api.postPortfolio()`

---

### ST-3 — View Painel: KPIs, mapa, quadrantes e histograma

**Status:** `[x] done`

**Intent:**
Construir a view principal (Painel) com os 4 KPI cards animados, o mapa Google Maps com
todos os layers e clustering, os botões de quadrante e o histograma de payback.

**Expected Outcomes:**
- 4 KPI cards exibem: payback médio portfólio, nº municípios, alunos conectados, CapEx alocado
- Valores animam de valor anterior para novo (ease-out, 450ms, respeitando prefers-reduced-motion)
- Mapa renderiza 417 municípios com marcadores coloridos por quadrante
- Clustering automático (MarkerClusterer) com ícone roxo circular + contador
- Layer backhaul: linhas entre PoPs + ícones quadrados roxos
- Layer escolas: marcadores laranja ao zoom ≥ 8 para municípios com déficit ENEC
- Layer densidade móvel: círculos vermelhos translúcidos
- Layer portfólio selecionado: marcadores com anel branco
- Hover: tooltip fixo com nome, quadrante, payback, M e I
- Click: abre Drawer (chama `store.openDrawer(id)`)
- Botão "⤢ Enquadrar visíveis": `fitBounds` para municípios que passam no filtro
- 5 botões de quadrante (Q1–Q4) com contagem + filtro: atualiza `filters.quadrante`
- Histograma de payback: 12 barras, verde (<6 anos) e cinza (≥6 anos)
- Contadores viáveis + migração Q2b→Q2a

**Todo List:**
1. Criar `src/hooks/useAnimatedValue.ts`: hook para contador animado
2. Criar `src/components/KPICard.tsx`: card com label, valor animado e descrição
3. Criar `src/components/KPIPanel.tsx`: grid 4 colunas com os 4 KPIs
4. Criar `src/components/MapContainer.tsx`:
   - `<LoadScript>` da `@react-google-maps/api` com `VITE_GOOGLE_MAPS_KEY`
   - `<GoogleMap>` com estilos customizados (sem POIs)
   - Hooks: `useEffect` para re-renderizar markers quando `municipios` ou `filters` mudam
   - Layer backhaul: `<Polyline>` + `<Marker>` para PoPs
   - Layer móvel: `<Circle>` por município
   - Layer escolas: markers condicionados ao zoom ≥ 8
   - Markers principais: ícone círculo colorido por quadrante, tamanho por população
   - `MarkerClusterer` do `@googlemaps/markerclusterer` com renderer customizado
   - Checkboxes de layer (`lyBack`, `lyEsc`, `lyMov`, `lySel`) lendo de `store.layers`
   - Botão "Enquadrar" como custom control do Google Maps
5. Criar `src/components/QuadrantButtons.tsx`: botões Q1–Q4 com contagem e filtro
6. Criar `src/components/PaybackHistogram.tsx` (Recharts `<BarChart>`):
   - 12 barras, cores condicionais
   - Labels "0", "6 anos", "12+"
7. Criar `src/pages/PanelView.tsx`:
   - Layout: `<KPIPanel>` + grid `1.6fr / 1fr` com `<MapContainer>` e painel direito
   - Painel direito: título, `<QuadrantButtons>`, stats viáveis/migração, `<PaybackHistogram>`
8. Adicionar variável de ambiente: `.env.local` com `VITE_GOOGLE_MAPS_KEY`

**Relevant Context:**
- `FRONT/painel.html` linhas 152-176: HTML do v-painel
- `FRONT/painel.html` linhas 254-373: toda a lógica de mapa (`drawMap`, `initMap`)
- `FRONT/painel.html` linhas 453-458: lógica do ticker e histograma
- `github/conecta-mais/web/src/api/client.ts`: tipo `Municipio` com lat/lon

---

### ST-4 — Drawer: Ficha Executiva por município

**Status:** `[x] done`

**Intent:**
Criar o drawer lateral que exibe a ficha executiva de um município ao clicar no mapa
ou na tabela, com diagnóstico completo, plano de ação e business case comparativo.

**Expected Outcomes:**
- Drawer desliza da direita (580px), overlay escurece o fundo
- Fecha ao clicar no overlay, no botão Fechar ou pressionar Esc
- Cabeçalho: nome do município, botão favoritar (☆/★), botão Imprimir/PDF
- Seção Diagnóstico: população, domicílios, escolas, alunos, PoP de fibra, base móvel Vivo, scores M e I, TCU
- Seção Plano de ação: tecnologia recomendada (FTTH/FWA/satélite), financiamento, Fundação Telefônica, status no portfólio
- Seção Business case: tabela comparativa "Sem alavancas" vs "Com alavancas" (CapEx, receita B2C, B2G, EBITDA, payback)
- Favorite toggling: ícone muda, localStorage atualizado, toast de feedback
- Print: apenas o conteúdo do drawer via `window.print()` com CSS adequado

**Todo List:**
1. Criar `src/hooks/useFavorites.ts`:
   - Persiste em `localStorage` com chave `cm_fav`
   - Retorna `[favSet, toggle]`
2. Criar `src/components/Drawer.tsx`:
   - shadcn/ui `<Sheet>` (side=right, tamanho 580px)
   - Overlay customizado
   - Lê `store.drawerOpen` e `store.selectedId`
   - Fecha com `store.closeDrawer()`
   - CSS de impressão via `@media print`
3. Criar `src/components/DrawerContent.tsx`:
   - Recebe `municipio: Municipio` + dados de cálculo financeiro
   - Chama `POST /financial` para obter business case com e sem alavancas
   - Renderiza todas as seções descritas nos Expected Outcomes
   - Botão favoritar conectado a `useFavorites`
4. Criar `src/utils/calculation.ts`:
   - `getTechRecommendation(dist, hab)`: retorna string com tecnologia recomendada

**Relevant Context:**
- `FRONT/painel.html` linhas 241-246: HTML do drawer
- `FRONT/painel.html` linhas 392-410: função `fichaRender()`
- `FRONT/painel.html` linhas 396-397: lógica de tecnologia recomendada
- `github/conecta-mais/web/src/api/client.ts`: `api.postFinancial()`

---

### ST-5 — View Municípios: tabela com filtros completos

**Status:** `[x] done`

**Intent:**
Evoluir o `ScoreMap.tsx` existente para a view completa de municípios do protótipo, com
busca, filtros, ordenação, coluna de favoritos e integração com o drawer.

**Expected Outcomes:**
- Input de busca por nome
- Select de quadrante (Q1–Q4 + "Todos")
- Toggle "Só portfólio" — filtra apenas municípios selecionados no portfólio atual
- Toggle "Só favoritos" — filtra apenas municípios marcados com estrela
- Tabela ordenável: Município, Quadrante, Habitants, Alunos, CapEx, Payback, Portfólio
- ★ aparece na frente do nome se favorito
- Badge de quadrante colorido (reutilizar/adaptar `QuadrantBadge.tsx`)
- Clicar em linha: abre drawer
- Teclado Enter em linha: abre drawer
- Contador "Mostrando X de Y municípios"
- Filtros em sincronia com a store (mesmos filtros da view Painel)

**Todo List:**
1. Adaptar `src/components/QuadrantBadge.tsx` para usar CSS vars em vez de inline styles
2. Refatorar `src/pages/ScoreMap.tsx` para ler da store (`municipios`, `filters`, `portfolio`)
3. Adicionar colunas: Alunos, CapEx (do `portfolio` result), Payback, status portfólio
4. Adicionar toggles "Só portfólio" e "Só favoritos" conectados à store
5. Adicionar click handler em linha → `store.openDrawer(m.id)`
6. Sincronizar filtros (search, quadrante) com `store.setFilters()`
7. Criar `src/pages/MunView.tsx` como wrapper fino em torno de `ScoreMap`

**Relevant Context:**
- `FRONT/painel.html` linhas 179-190: HTML do v-mun
- `FRONT/painel.html` linhas 374-388: funções `tbl()`, colunas, KF
- `github/conecta-mais/web/src/pages/ScoreMap.tsx`: base a refatorar
- `github/conecta-mais/web/src/components/QuadrantBadge.tsx`: adaptar

---

### ST-6 — View Agente: chat simulado (arquitetura substituível)

**Status:** `[x] done`

**Intent:**
Construir a view de chat com interface pronta para produção e lógica simulada que
pode ser trocada por chamadas reais à API do Chris (watsonx.ai Granite) sem alterar
a UI.

**Expected Outcomes:**
- Thread de mensagens com scroll automático para o mais recente
- Mensagens do usuário: alinhadas à direita, fundo roxo
- Mensagens do agente: alinhadas à esquerda, fundo suave, com label de fonte + confiança
- Indicador de digitação animado (3 pontinhos) por 700ms antes da resposta
- 4 chips de perguntas sugeridas pré-definidas
- Input de texto + botão Enviar; Enter também envia
- Respostas simuladas para: semiárido + estudantes, priorizar município, FUST, TCU, padrão
- Arquitetura: função `getAnswer(question, context)` isolada em `src/api/chatService.ts` — mock hoje, real depois
- Contexto de resposta: lê do store (portfólio atual, orçamento, municípios viáveis)

**Todo List:**
1. Criar `src/api/chatService.ts`:
   - Interface `ChatAnswer { text: string; source: string }`
   - Função `getAnswer(q: string, ctx: ChatContext): Promise<ChatAnswer>`
   - Implementação mock com mesmo comportamento do protótipo
   - Exportar separadamente para facilitar substituição futura
2. Criar `src/components/ChatMessage.tsx`:
   - Props: `role: 'user' | 'agent'`, `text`, `source?`, `isTyping?`
   - Typing indicator: 3 círculos com animação `bounce-dot`
3. Criar `src/pages/ChatView.tsx`:
   - Estado local: `messages[]`, `input`, `loading`
   - Chips: 4 perguntas sugeridas
   - Scroll automático com `useRef` + `useEffect`
   - Chama `getAnswer()` e exibe loading → resposta

**Relevant Context:**
- `FRONT/painel.html` linhas 192-199: HTML do v-chat
- `FRONT/painel.html` linhas 423-443: funções `answer()` e `ask()`
- `FRONT/painel.html` linhas 69-76: CSS de `.msgs`, `.m`, `.chip`, `.ty`

---

### ST-7 — View Solução: arquitetura, ROI e fases

**Status:** `[x] done`

**Intent:**
Construir a view estática de apresentação da solução com KPIs do mercado, seletor de
agentes IBM watsonx, tabela de ROI e cards de fases de entrega.

**Expected Outcomes:**
- 4 KPI cards estáticos: cobertura Vivo 8%, CapEx R$ 9,27 bi, 28 mi sem internet, ~9 mil escolas
- Grid 2 colunas: painel de agentes (esquerda) + tabela ROI (direita)
- 5 botões de agente: clicar seleciona e exibe descrição abaixo
- Tabela ROI: 5 linhas de impacto + total em verde (R$ 102,5–148,5 mi)
- 4 cards: Fase 1 MVP, Fase 2 Escala, Fase 3 Expansão, Riscos
- Botão "Imprimir / PDF" no cabeçalho do drawer (browser print)

**Todo List:**
1. Criar `src/pages/SolutionView.tsx`:
   - Importar constantes de `src/utils/constants.ts` (`AGENT_DESCRIPTIONS`, dados de ROI, fases)
   - Estado local: `selectedAgent: number | null`
   - Renderizar todas as seções descritas
2. Extrair dados estáticos (agentes, ROI, fases, KPIs) para `src/utils/constants.ts`

**Relevant Context:**
- `FRONT/painel.html` linhas 202-236: HTML do v-sol
- `FRONT/painel.html` linhas 413-420: dados dos agentes
- `FRONT/painel.html` linhas 204-209: KPIs estáticos

---

### ST-8 — Paleta de comandos (Ctrl+K) e ajustes finais de UX

**Status:** `[x] done`

**Intent:**
Implementar a paleta de comandos (Ctrl+K) para navegação rápida e finalizar os
ajustes de UX: dark mode automático, responsividade mobile e acessibilidade.

**Expected Outcomes:**
- Ctrl+K (ou Cmd+K) abre modal fullscreen com input de busca
- Itens: "Ir para Painel/Municípios/Agente/Solução", "Aplicar cenário completo", municípios matching
- Navegação por ↑/↓, Enter executa, Esc fecha
- Municípios mostram quadrante + payback como descrição
- Dark mode: funciona via `prefers-color-scheme` (automático) + toggle manual na sidebar
- `[data-theme="dark"]` no `<html>` quando manual; removido quando auto
- Layout responsivo: sidebar horizontal no mobile (<900px), filtros colapsáveis
- ARIA: `role="dialog"`, `aria-modal`, `aria-label` em elementos interativos
- Focus trap no drawer e na paleta

**Todo List:**
1. Criar `src/components/CommandPalette.tsx`:
   - Modal com backdrop
   - Input com debounce de 150ms
   - Lógica de busca: views + ação + municípios (max 8)
   - Keyboard navigation com `useRef` para item ativo
   - Conectado a `store.cmdPaletteOpen`
2. Adicionar listener `keydown` global em `App.tsx` para Ctrl/Cmd+K
3. Adicionar toggle de tema na sidebar (ícone lua/sol) → `store.setTheme()`
4. Sincronizar `document.documentElement.dataset.theme` com `store.theme`
5. Revisar responsividade de cada view no breakpoint 600px e 900px
6. Adicionar `aria-*` e `role` nos componentes principais
7. Testar keyboard navigation: drawer, paleta, tabela

**Relevant Context:**
- `FRONT/painel.html` linhas 91-96: CSS do modal e paleta
- `FRONT/painel.html` linhas 465-475: funções `pal()`, `drawPal()`, keyboard nav
- `FRONT/painel.html` linhas 17-18: dark theme CSS

---

### ST-9 — Integração final com a API e dados reais

**Status:** `[x] done`

**Intent:**
Substituir qualquer dado simulado remanescente pela API real do Rafael, ajustar o
carregamento inicial e tratar estados de loading/erro em todos os componentes.

**Expected Outcomes:**
- `GET /municipios` é chamado uma vez na inicialização da app
- Loading state: spinner/skeleton em cada view enquanto aguarda
- Erro state: mensagem clara se a API não estiver disponível
- `POST /portfolio` é disparado com debounce ao mudar orçamento ou alavancas
- `POST /financial` é chamado ao abrir um drawer de município
- `GET /backtest` é chamado e resultado exibido na view Solução (se aplicável)
- Variável `VITE_API_BASE` em `.env.local` para apontar para o backend (default: proxy `/api`)
- Build de produção (`npm run build`) sem erros de TypeScript

**Todo List:**
1. Atualizar `src/api/client.ts` com endpoint `/backtest` se necessário
2. Criar `src/hooks/useInitialData.ts`: carrega `municipios` + calcula portfólio inicial
3. Adicionar skeleton/spinner em `MapContainer`, `KPIPanel`, `MunicipiosTable`
4. Tratar erros de rede com mensagem amigável e botão de retry
5. Testar fluxo completo: abrir app → slider → alavancas → clicar município → drawer → favoritar
6. Rodar `npm run lint` (oxlint) e corrigir todos os avisos
7. Rodar `tsc --noEmit` e corrigir todos os erros de tipos
8. Rodar `npm run build` e verificar que o bundle não tem erros

**Relevant Context:**
- `github/conecta-mais/web/src/api/client.ts`: cliente HTTP existente
- `github/conecta-mais/engine/api/main.py`: endpoints disponíveis
- `github/conecta-mais/web/vite.config.ts`: proxy `/api` → `localhost:8000`

---

## Diagrama de dependências entre sub-tarefas

```
ST-1 (Fundação)
  └─► ST-2 (Header)
  └─► ST-3 (View Painel)
        └─► ST-4 (Drawer)
  └─► ST-5 (View Municípios)
        └─► ST-4 (Drawer)
  └─► ST-6 (View Agente)
  └─► ST-7 (View Solução)
ST-1 + ST-2 + ST-3 + ST-4 + ST-5 + ST-6 + ST-7
  └─► ST-8 (Paleta + UX final)
  └─► ST-9 (Integração final)
```

## Decisões técnicas registradas

| Decisão | Escolha | Motivo |
|---|---|---|
| Linguagem | TypeScript | Já no projeto; tipos da API prontos em `client.ts` |
| Estado global | Zustand | Leve, sem boilerplate; estado compartilhado entre Painel/Municípios/Header |
| Mapa | @react-google-maps/api | Wrapper React oficial; reutiliza API key do protótipo |
| Cálculo de portfólio | POST /portfolio (API real) | MILP real é mais preciso; latência aceitável com debounce |
| Histograma | Recharts | React-native, leve, suficiente para 12 barras |
| Componentes base | shadcn/ui | Base do 21st.dev; CSS vars compatíveis com design tokens |
| Chat | Simulado (substituível) | `chatService.ts` isolado; trocar por API real sem mexer na UI |
| Ícones | lucide-react | Padrão shadcn/ui; consistente |
| Build target | github/conecta-mais/web/ | Aproveita Vite + Tailwind + proxy já configurados |
