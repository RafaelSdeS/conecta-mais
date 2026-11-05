# Design Thinking do Conecta+

Aplicação do Enterprise Design Thinking da IBM à experiência de uso em campo.

> **Estado da validação:** até agora **não houve contato com usuários reais**. Tudo nas seções de usuário,
> mapa de empatia e cenários é hipótese da equipe, e os testes usam a própria equipe no lugar dos usuários.
> Nenhuma frase aqui é depoimento. Ao falar com Sponsor Users, atualize este documento e registre o que mudou.

## Como o método entra

| Elemento | Aplicação |
|---|---|
| **Foco nos resultados do usuário** | O sucesso é medido pela decisão tomada em campo (Hills), não por funcionalidades entregues |
| **Reinvenção contínua** | Cada entrega passa pelo Loop: observar, refletir e fazer |
| **Equipes diversas e autônomas** | Rafael (motor), Joel (produto) e Chris (dados e IA) revisam juntos em cada Playback |
| **Sponsor Users** | Ainda não há; ver "Quem recrutar" |
| **Hills** | Três resultados com critério de medida, abaixo |
| **Playbacks** | Registrados no fim deste documento |

## Usuário principal (hipótese)

**Gestor regional da Vivo.** Visita municípios, conversa com prefeitura e provedores locais e recomenda se vale levar a expansão adiante. Decide com o celular, entre deslocamentos, e depois precisa defender a recomendação perante o Comitê de CapEx.

Quem analisa no escritório (Analista de Expansão, CFO, Relações Regulatórias, Fundação e ESG) continua atendido pelo Painel, pela tabela e pelo Agente.

## Mapa de empatia (hipótese)

| | |
|---|---|
| **Pensa** | Vale meu tempo ir a este município? O que preciso saber antes de falar com a prefeitura? |
| **Sente** | Pressão para justificar a recomendação; desconforto em citar números que não sabe explicar |
| **Faz** | Pergunta a colegas, junta planilhas, anota no celular, envia resumo por mensagem |
| **Diz** | Quer uma resposta direta e o motivo, não um painel para interpretar |

## Cenário atual (como o app era)

1. Abre o app e encontra orçamento, objetivo, alavancas e premissas antes de qualquer resposta.
2. Procura o município num mapa ou numa tabela de 8 colunas, pouco práticos no celular.
3. Lê "Expandir já" ao lado de VPL negativo, sem explicação do conflito.
4. Precisa saber o que significam CapEx, VPL, PoP e os quadrantes; as dicas só aparecem com o mouse.
5. Não acha endereço nem telefone das escolas, e não há como registrar o que viu ou compartilhar um resumo.

## Hills

Critérios de medida são hipóteses, a ajustar com Sponsor Users.

1. **Decidir:** o gestor, com o celular na mão, sabe em até **30 segundos** se vale levar um município adiante, por quê e o próximo passo, sem precisar saber o que é VPL.
2. **Preparar:** em até **2 minutos**, tem as escolas prioritárias com endereço e telefone, os provedores locais e um resumo para compartilhar.
3. **Registrar:** ao sair da visita, grava a recomendação e o que viu em até **1 minuto** e leva isso ao comitê.

## Cenário futuro

1. Abre o app e já vê a tela Campo: toca em "Perto de mim" ou busca o município.
2. Lê o veredito, os motivos em linguagem simples, o que os dados não cobrem e os próximos passos.
3. Abre o kit da visita: escolas por número de alunos, com telefone e mapa, UBS e provedores.
4. Compartilha o resumo com a equipe e, ao sair, registra a recomendação e o que observou.
5. Na carteira, compara os municípios visitados e exporta tudo para o comitê.

## Priorização

| Item | Valor esperado | Esforço | Decisão |
|---|---|---|---|
| Veredito com motivos | Alto | Baixo | Entra |
| Tela Campo e "Perto de mim" | Alto | Baixo | Entra |
| Kit da visita e compartilhamento | Alto | Médio | Entra |
| Registro da recomendação no aparelho | Alto | Baixo | Entra |
| Linguagem simples e estados de tela | Médio | Baixo | Entra |
| Comparação lado a lado | Médio | Médio | Depois: os cartões da carteira já comparam |
| Login e decisões compartilhadas | Alto | Alto | Depois: quando mais de uma pessoa precisar ver |
| Funcionar sem internet | A validar | Alto | Fora do MVP, por decisão da equipe |
| Mapa de escolas e roteirização | Médio | Alto | Depende de outra fonte: o INEP retirou as coordenadas de 2024 |

## Quem recrutar (Sponsor Users)

De 3 a 5 pessoas que decidem expansão em campo na Vivo, de regiões diferentes e com pelo menos uma atuando em área de baixa conexão. Perguntas para a primeira conversa:

1. Conte a última vez que decidiu se valia avançar num município. O que olhou, com quem falou e quanto tempo levou?
2. O que você precisa ter em mãos antes de uma visita? Onde encontra isso hoje?
3. Como a recomendação chega ao comitê? O que costuma ser questionado?
4. Em que situação a falta de internet atrapalhou seu trabalho?

## Roteiro de teste (uma tarefa por Hill)

Use um celular, sem explicar o app antes. Cronometre, anote onde a pessoa travou e não ajude.

| Tarefa | Meta | Sucesso |
|---|---|---|
| "Você está em Monte Santo (BA). Vale levar adiante? Por quê? O que faz agora?" | 30 s | Responde os três pontos com as próprias palavras |
| "Prepare a visita a esse município e envie um resumo a um colega." | 2 min | Acha uma escola com telefone e gera o texto compartilhado |
| "Você saiu da visita. Registre sua recomendação e o que viu." | 1 min | A recomendação aparece na carteira |

Ao final, pergunte: o que travou você? Em que você não confiou? O que faltou para decidir?

## Playbacks

### Playback 0: revisão sem usuários

Teste automatizado no Chromium em tamanho de celular (390×844), com localização simulada e dados reais, mais revisão das telas. **Não valida as Hills:** mostra se o fluxo funciona, não se resolve o problema de quem está em campo, e o tempo de leitura não foi medido.

O teste percorreu a busca, o veredito, o kit da visita, o compartilhamento, o registro da recomendação, a persistência depois de recarregar, a exportação da carteira, "Perto de mim", a falha de rede e as telas de análise.

**O que a revisão encontrou e mudou:**

| Achado | Mudança |
|---|---|
| A ficha de Salvador mostrava ~8,2 milhões de habitantes | `domicilios_urbanos` era população × 0,8; passou a usar domicílios ocupados do Censo 2022 |
| As prioridades do Brasil inteiro passavam de 30 s, porque o solver gastava todo o limite tentando provar a solução ótima | Limite de 3 s, com objetivo a até 0,35% do resultado de 30 s; a lista agora aparece em cerca de 5 s |
| Todos os cartões diziam "5,7 anos", o piso do modelo | Os cartões passam a mostrar o investimento |
| Durante o cálculo, a lista mostrava só parte dos municípios, em ordem errada | A lista espera o cálculo terminar |
| Marcadores de lista e seta de "Detalhes" invisíveis | Corrigidos |
| A explicação dos termos abria colada no canto da tela | Abre centralizada |

**Como os 5.570 municípios se distribuem, com as premissas padrão:**

| Veredito | Municípios |
|---|---|
| Levar adiante | 296 |
| Levar adiante pelo comercial | 373 |
| Só com apoio | 2.489 |
| Avaliar compra ou parceria | 1.227 |
| Não priorizar agora | 1.185 |

**Perguntas para o próximo Playback:**

1. "Levar adiante" ao lado de VPL negativo faz sentido para quem decide, ou tira a confiança? Sem alavancas, nenhum município tem VPL positivo com as premissas padrão.
2. "Só com apoio" cobre 45% dos municípios. É útil ou amplo demais?
3. O limite de 6 anos de retorno é o que a operadora usaria?
4. Os próximos passos são os que o gestor realmente seguiria?
5. A falta de internet em campo bloqueia o uso? O MVP não funciona sem conexão.
6. O que "impacto alto" deveria exigir? Dos 2.785 municípios de impacto alto, 480 não têm nenhuma escola sem internet para aprendizagem: a pontuação deles vem principalmente do perfil rural e da vulnerabilidade social, que é uma média do estado. O cartão explica isso, mas o modelo não mudou.

### Playback 1: equipe no lugar dos usuários
Pendente; a equipe aplica o roteiro acima e registra aqui tempos, travas e o que muda.
