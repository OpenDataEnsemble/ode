# Multi-stage build: Portal (React) -> Synkronus (Go with embedded portal) -> single runtime image
# Stage 1: Build the React application (Portal)
FROM node:24-alpine AS portal-builder

WORKDIR /app

# Copy package files for all packages (monorepo structure)
COPY packages/tokens/package*.json ./packages/tokens/
COPY packages/tokens/package-lock.json ./packages/tokens/
COPY packages/tokens/style-dictionary.config.js ./packages/tokens/
COPY packages/tokens/config.json ./packages/tokens/
COPY packages/tokens/scripts ./packages/tokens/scripts
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

# Stage 2: Build the Go application (Synkronus) with embedded portal
FROM golang:1.26.0-alpine AS synkronus-builder

RUN apk add --no-cache git

WORKDIR /build

# Copy go mod files and download dependencies
COPY synkronus/go.mod synkronus/go.sum ./
RUN go mod download

# Copy Synkronus source
COPY synkronus/ ./

# Embed the portal build into the binary (must exist at go build time)
COPY --from=portal-builder /app/synkronus-portal/dist ./portal/dist

# Build the application with version from build arg
# Version is automatically derived from git tags in CI and passed as build arg
# Defaults to "dev" for local builds without tags
ARG SYNKRONUS_VERSION=dev
ENV CGO_ENABLED=0 GOOS=linux
RUN echo "Building Synkronus with version: ${SYNKRONUS_VERSION}" && \
    go build -a -ldflags="-w -s -X github.com/opendataensemble/synkronus/pkg/version.version=${SYNKRONUS_VERSION}" -o synkronus ./cmd/synkronus

# Stage 3: Minimal runtime image — single Go server (API + portal)
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata wget

# Non-root user
RUN addgroup -g 1000 synkronus && \
    adduser -D -u 1000 -G synkronus synkronus

WORKDIR /app

# Binary and assets (portal is embedded in the binary)
COPY --from=synkronus-builder /build/synkronus /app/synkronus
COPY --from=synkronus-builder /build/openapi /app/openapi
COPY --from=synkronus-builder /build/static /app/static

RUN mkdir -p /app/data/app-bundles && \
    chown -R synkronus:synkronus /app

USER synkronus

# Go server listens on 80 so existing port mapping 8080:80 still works
ENV PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 -O - http://127.0.0.1/health || exit 1

CMD ["/app/synkronus"]
