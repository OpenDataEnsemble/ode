# Multi-stage build for Synkronus
# Stage 1: Build the Go application
# Pure Go build (PostgreSQL only, SQLite/CGO disabled by default)
FROM golang:1.26.0-alpine AS builder

# Install build dependencies (no C toolchain needed for pure Go build)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with version from build arg
# Version is automatically derived from git tags in CI and passed as build arg
# Defaults to a semantic version for local builds without tags (middleware requires semver)
ARG SYNKRONUS_VERSION=1.0.0
ENV CGO_ENABLED=0 GOOS=linux
RUN echo "Building Synkronus with version: ${SYNKRONUS_VERSION}" && \
    go build -a -ldflags="-w -s -X github.com/opendataensemble/synkronus/pkg/version.version=${SYNKRONUS_VERSION}" -o synkronus ./cmd/synkronus

# Stage 2: Create minimal runtime image
FROM alpine:latest

# Install runtime dependencies (wget needed for container healthcheck)
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user for security
RUN addgroup -g 1000 synkronus && \
    adduser -D -u 1000 -G synkronus synkronus

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/synkronus .

# Copy openapi directory for Swagger UI
COPY --from=builder /app/openapi /app/openapi

# Copy static directory for static files
COPY --from=builder /app/static /app/static

# Mount a volume at /app/data. Subdirs also created at runtime.
RUN mkdir -p /app/data/app-bundle/active /app/data/app-bundle/versions /app/data/attachments && \
    chown -R synkronus:synkronus /app

# Switch to non-root user
USER synkronus

# Expose port (default 8080, configurable via PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 -O - http://127.0.0.1:8080/health || wget --no-verbose --tries=1 -O - http://localhost:8080/health || exit 1

# Run the application
CMD ["./synkronus"]
