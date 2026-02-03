# Multi-stage build for combined Synkronus + Portal
# Stage 1: Build the Go application (Synkronus)
FROM golang:1.24.2-alpine AS synkronus-builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY synkronus/go.mod synkronus/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY synkronus/ .

# Build the application
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -a -ldflags='-w -s' -o synkronus ./cmd/synkronus

# Stage 2: Build the React application (Portal)
FROM node:20-alpine AS portal-builder

WORKDIR /app

# Copy package files for all packages (monorepo structure)
COPY packages/tokens/package*.json ./packages/tokens/
COPY packages/tokens/package-lock.json ./packages/tokens/
COPY packages/tokens/style-dictionary.config.js ./packages/tokens/
COPY packages/tokens/config.json ./packages/tokens/
COPY packages/tokens/src ./packages/tokens/src
COPY packages/components/package*.json ./packages/components/
COPY synkronus-portal/package*.json ./synkronus-portal/
COPY synkronus-portal/package-lock.json ./synkronus-portal/

# Install dependencies for tokens
WORKDIR /app/packages/tokens
RUN npm ci

# Install dependencies for components
WORKDIR /app/packages/components
RUN npm install

# Install dependencies for portal
WORKDIR /app/synkronus-portal
RUN npm ci

# Copy source code for all packages
WORKDIR /app
COPY packages/tokens ./packages/tokens
COPY packages/components ./packages/components
COPY synkronus-portal ./synkronus-portal

# Build tokens first (if needed)
WORKDIR /app/packages/tokens
RUN npm run build || true

# Build components (if needed)
WORKDIR /app/packages/components
RUN npm run build || true

# Build the portal application
WORKDIR /app/synkronus-portal
RUN npm run build

# Stage 3: Combine both in final image
FROM nginx:alpine

# Install runtime dependencies for synkronus (wget for healthcheck, su-exec for user switching)
RUN apk --no-cache add ca-certificates tzdata wget su-exec

# Create non-root user for synkronus
RUN addgroup -g 1000 synkronus && \
    adduser -D -u 1000 -G synkronus synkronus

# Copy synkronus binary and assets from builder
WORKDIR /app
COPY --from=synkronus-builder /app/synkronus /app/synkronus
COPY --from=synkronus-builder /app/openapi /app/openapi
COPY --from=synkronus-builder /app/static /app/static

# Create directories for data storage with proper permissions
RUN mkdir -p /app/data/app-bundles && \
    chown -R synkronus:synkronus /app

# Copy portal built assets
COPY --from=portal-builder /app/synkronus-portal/dist /usr/share/nginx/html

# Create nginx configuration
# Proxy /api requests to local synkronus backend on port 8080
RUN echo 'server { \
    listen 0.0.0.0:80; \
    listen [::]:80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Serve portal frontend \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Proxy API requests to local synkronus backend \
    location /api { \
        rewrite ^/api(.*)$ $1 break; \
        proxy_pass http://127.0.0.1:8080; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
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
}' > /etc/nginx/conf.d/default.conf

# Create startup script to run both services
RUN printf '#!/bin/sh\n\
set -e\n\
\n\
# Function to handle shutdown\n\
cleanup() {\n\
    echo "Shutting down..."\n\
    kill -TERM "$synkronus_pid" 2>/dev/null || true\n\
    nginx -s quit 2>/dev/null || true\n\
    wait "$synkronus_pid" 2>/dev/null || true\n\
    exit 0\n\
}\n\
\n\
# Trap signals for graceful shutdown\n\
trap cleanup SIGTERM SIGINT\n\
\n\
# Start synkronus in background as non-root user\n\
su-exec synkronus /app/synkronus &\n\
synkronus_pid=$!\n\
\n\
# Wait a moment for synkronus to start\n\
sleep 2\n\
\n\
# Start nginx in foreground (this blocks, shell remains PID 1 for signal handling)\n\
nginx -g "daemon off;"\n\
' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

# Health check - check synkronus health endpoint through nginx proxy
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 -O - http://127.0.0.1/api/health || exit 1

# Use custom entrypoint to run both services
ENTRYPOINT ["/docker-entrypoint.sh"]

