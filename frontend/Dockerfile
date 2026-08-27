# ── build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências (cache separado do código-fonte)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copia o restante e compila em modo produção
COPY . .
RUN npm run build

# ── runtime stage ───────────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove o conteúdo padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia o build do Angular — saída padrão do @angular/build (Angular 17+)
COPY --from=builder /app/dist/controle-acesso/browser /usr/share/nginx/html

# Roteamento SPA: redireciona qualquer 404 para index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
