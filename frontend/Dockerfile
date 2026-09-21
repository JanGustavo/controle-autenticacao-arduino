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

# Configura Nginx como servidor estático + Reverse Proxy para WebSocket (/ws/logs) e REST (/api)
RUN printf 'server {\n    listen 80;\n    root /usr/share/nginx/html;\n    index index.html;\n\n    resolver 127.0.0.11 valid=10s;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n\n    location /api/ {\n        set $upstream http://backend:8000;\n        proxy_pass $upstream;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        rewrite ^/api/(.*)$ /api/$1 break;\n    }\n\n    location /ws/ {\n        set $upstream_ws http://backend:8000;\n        proxy_pass $upstream_ws;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "Upgrade";\n        proxy_set_header Host $host;\n    }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
