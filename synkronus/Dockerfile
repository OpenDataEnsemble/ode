# Multi-stage build for Synkronus
# Stage 1: Build the Go application
# Pure Go build (PostgreSQL only, SQLite/CGO disabled by default)
FROM golang:1.24.2-alpine AS builder

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

# Build the application
# CGO is disabled so the binary is pure Go (better for multi-arch Docker builds)
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -a -ldflags='-w -s' -o synkronus ./cmd/synkronus

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

# Create directories for data storage with proper permissions
RUN mkdir -p /app/data/app-bundles && \
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
