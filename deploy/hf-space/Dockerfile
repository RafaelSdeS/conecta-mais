# Imagem do protótipo público (Hugging Face Spaces, SDK Docker).
# O Space só precisa deste Dockerfile e do README.md ao lado: o código vem do repositório
# público, clonado no build. Para publicar uma versão nova: "Factory rebuild" no Space.
ARG REPO=https://github.com/RafaelSdeS/conecta-mais.git
ARG REF=main

FROM alpine/git AS src
ARG REPO
ARG REF
RUN git clone --depth 1 --branch "$REF" "$REPO" /src

FROM node:22-slim AS web
WORKDIR /web
COPY --from=src /src/web/package*.json ./
RUN npm ci
COPY --from=src /src/web/ ./
RUN npm run build

FROM python:3.12-slim
# O Spaces executa o contêiner com o uid 1000.
RUN useradd -m -u 1000 app
WORKDIR /app
COPY --from=src --chown=app:app /src/engine ./engine
COPY --from=src --chown=app:app /src/docs ./docs
COPY --from=web --chown=app:app /web/dist ./web/dist
# Instalação editável: os caminhos de dados e do RAG partem do código em /app/engine.
# data/raw (cache do ETL, ~40 MB) não é usado em execução.
RUN rm -rf engine/data/raw \
 && pip install --no-cache-dir -e ./engine \
 && chown -R app:app /app/engine
USER app
WORKDIR /app/engine
# O índice do RAG é gerado a partir de docs/ e do código (offline).
RUN python -m conecta.rag.indexer

# Disco do Space é efêmero: decisões e auditoria ficam em /tmp e zeram ao reiniciar.
ENV CONECTA_WEB_DIST=/app/web/dist \
    CONECTA_SQLITE_PATH=/app/engine/data/conecta_mais.db \
    CONECTA_DECISOES_PATH=/tmp/decisoes.db \
    CONECTA_AUDIT_LOG=/tmp/auditoria_ia.jsonl \
    CONECTA_IA_LIMITE_IP=20 \
    CONECTA_IA_LIMITE_GLOBAL=300
# As credenciais do watsonx (WATSONX_APIKEY, WATSONX_PROJECT_ID, WATSONX_URL, WATSONX_MODEL_ID,
# WATSONX_MAX_TOKENS) entram como Secrets do Space, nunca na imagem.

# 7860 é a porta do Hugging Face Spaces; Render e similares definem PORT.
EXPOSE 7860
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
