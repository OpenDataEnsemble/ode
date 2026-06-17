# Multi-stage build: Portal (React) -> Synkronus (Go with embedded portal) -> single runtime image
# Stage 1: Build the React application (Portal)
FROM node:24-alpine AS portal-builder

# OpenAPI Generator CLI invokes Java during synkronus-portal prebuild (not installed in node:alpine)
RUN apk add --no-cache openjdk21-jre-headless

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

COPY packages/tokens/package.json packages/tokens/pnpm-lock.yaml ./packages/tokens/
COPY packages/tokens/style-dictionary.config.js ./packages/tokens/
COPY packages/tokens/config.json ./packages/tokens/
COPY packages/tokens/scripts ./packages/tokens/scripts
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
COPY synkronus/openapi ./synkronus/openapi

WORKDIR /app/packages/tokens
RUN pnpm run build || true

WORKDIR /app/packages/components
RUN pnpm run build || true

WORKDIR /app/synkronus-portal
RUN pnpm run build

# Stage 2: Build the Go application (Synkronus) with embedded portal
FROM golang:1.26.0-alpine AS synkronus-builder

RUN apk add --no-cache git

WORKDIR /build

COPY synkronus/go.mod synkronus/go.sum ./
RUN go mod download

COPY synkronus/ ./

COPY --from=portal-builder /app/synkronus-portal/dist ./portal/dist

ARG SYNKRONUS_VERSION=1.0.0
ENV CGO_ENABLED=0 GOOS=linux
RUN echo "Building Synkronus with version: ${SYNKRONUS_VERSION}" && \
    go build -a -ldflags="-w -s -X github.com/opendataensemble/synkronus/pkg/version.version=${SYNKRONUS_VERSION}" -o synkronus ./cmd/synkronus

# Stage 3: Minimal runtime image — single Go server (API + portal)
FROM alpine:3.23

RUN apk --no-cache add ca-certificates tzdata wget

RUN addgroup -g 1000 synkronus && \
    adduser -D -u 1000 -G synkronus synkronus

WORKDIR /app

COPY --from=synkronus-builder /build/synkronus /app/synkronus
COPY --from=synkronus-builder /build/openapi /app/openapi
COPY --from=synkronus-builder /build/static /app/static

RUN mkdir -p /app/data/app-bundle/active /app/data/app-bundle/versions /app/data/attachments && \
    chown -R synkronus:synkronus /app

USER synkronus

ENV PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 -O - http://127.0.0.1/health || exit 1

CMD ["/app/synkronus"]
