# ── build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copia o código-fonte e compila em modo produção
COPY . .
RUN npm run build

# ── runtime stage ───────────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove o conteúdo padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia o build do Angular
COPY --from=builder /app/dist/controle-acesso/browser /usr/share/nginx/html

# Configuração versionada, incluindo a política de cache.
COPY nginx.conf /etc/nginx/conf.d/default.conf

ARG APP_BUILD_REVISION=unknown
ARG APP_BUILD_TIME=unknown
LABEL org.opencontainers.image.revision=$APP_BUILD_REVISION
LABEL org.opencontainers.image.created=$APP_BUILD_TIME
RUN printf '{"revision":"%s","built_at":"%s"}\n' "$APP_BUILD_REVISION" "$APP_BUILD_TIME" > /usr/share/nginx/html/version.json

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
