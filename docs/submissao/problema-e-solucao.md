# Conecta+: declaração do problema e da solução

## O problema

A fibra da Vivo chega a 453 cidades brasileiras, cerca de 8% dos municípios, e a empresa busca reduzir a intensidade de CapEx. Ao mesmo tempo, 46.357 escolas públicas (34% de 137.755) não têm internet adequada para aprendizagem, o que atinge 8,5 milhões de matrículas. Instrumentos públicos que mudariam essa conta atuam nas mesmas regiões: o FUST, o backhaul do acordo de migração da concessão (121 municípios) e a Estratégia Nacional de Escolas Conectadas (R$ 8,8 bilhões). Eles são avaliados separadamente do plano comercial.

No meio disso está a gestora regional de expansão. Ela decide onde investir, ouve dos prefeitos "por que minha cidade ficou de fora?" e precisa defender cada escolha no comitê de CapEx, trabalhando com planilhas espalhadas e premissas implícitas.

## A solução

O Conecta+ é um sistema web de apoio à decisão. Ele pontua os 5.565 municípios em Mercado, Impacto educacional, Custo e Alavancas públicas e monta o melhor portfólio para um orçamento, com um otimizador de programação inteira mista que pesa payback, VPL e alunos atendidos.

A gestora trabalha num mapa e num cenário que ela altera: orçamento, objetivo, alavancas (FUST, acordo da concessão, receita escolar) e região. O cenário fica na URL, então um link reabre a mesma tela para um colega.

Cada município tem uma ficha executiva que responde ao prefeito: "Ficou fora: custa R$ 120,27 mi e sobram R$ 0,21 mi no orçamento." Com um clique em "O que mudaria para incluir?", o sistema recalcula o portfólio inteiro com aquela cidade dentro e mostra o preço da exceção: saem 20 municípios, 635 alunos deixam de ser atendidos e o VPL fica R$ 9,09 mi maior. Se ela aprovar mesmo assim, a decisão é registrada com o motivo e marcada como exceção, e o servidor recalcula os números. Um dossiê em PDF reúne cenário, decisões e limites dos dados para o comitê.

Um agente com o IBM Granite, no watsonx.ai, responde em linguagem simples, por exemplo quais municípios do semiárido da Bahia têm mais alunos sem internet por real investido. O botão "O que eu não estou vendo?" faz o motor procurar o que pode ter passado despercebido, cada achado com uma ação de um clique.

## Por que é diferente

- **Explica a exclusão, não só o ranking.** Para cada cidade diz por que entrou ou ficou de fora, o que mudaria isso e quanto custa a exceção.
- **Uma conta no lugar de três análises.** Retorno privado, impacto educacional e recursos públicos entram juntos.
- **A IA não faz conta.** Um motor determinístico calcula todos os números. O Granite só os redige, com fontes, o aviso "revise antes de decidir" e trilha de auditoria.
- **Admite os próprios limites.** Cada campo é rotulado como real, aproximado ou neutro, e o app informa que o backtest 2021→2025 acerta só um pouco acima do acaso (lift de 1,13).

Resultado: um cenário único e defensável no lugar de uma planilha nova a cada visita.
