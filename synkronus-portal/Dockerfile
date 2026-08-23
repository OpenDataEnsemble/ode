# Multi-stage build for Synkronus Portal (build context: repository root)
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY packages/tokens/package.json packages/tokens/pnpm-lock.yaml ./packages/tokens/
COPY packages/tokens/style-dictionary.config.js ./packages/tokens/
COPY packages/tokens/config.json ./packages/tokens/
COPY packages/tokens/src ./packages/tokens/src
COPY packages/components/package.json packages/components/pnpm-lock.yaml ./packages/components/
COPY synkronus-portal/package.json synkronus-portal/pnpm-lock.yaml ./synkronus-portal/

WORKDIR /app/packages/tokens
RUN pnpm install --frozen-lockfile

WORKDIR /app/packages/components
RUN pnpm install --frozen-lockfile

WORKDIR /app/synkronus-portal
RUN pnpm install --frozen-lockfile

WORKDIR /app
COPY packages/tokens ./packages/tokens
COPY packages/components ./packages/components
COPY synkronus-portal ./synkronus-portal

WORKDIR /app/packages/tokens
RUN pnpm run build || true

WORKDIR /app/packages/components
RUN pnpm run build || true

WORKDIR /app/synkronus-portal
RUN pnpm run build

FROM nginx:alpine

COPY --from=builder /app/synkronus-portal/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 0.0.0.0:80; \
    listen [::]:80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://demo.synkronus.cloud; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host demo.synkronus.cloud; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_set_header X-Forwarded-Host $host; \
        proxy_set_header Authorization $http_authorization; \
        proxy_pass_request_headers on; \
        proxy_connect_timeout 60s; \
        proxy_send_timeout 60s; \
        proxy_read_timeout 60s; \
        proxy_buffering off; \
        client_max_body_size 100M; \
    } \
    location = /health { \
        proxy_pass http://demo.synkronus.cloud; \
        proxy_http_version 1.1; \
        proxy_set_header Host demo.synkronus.cloud; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
