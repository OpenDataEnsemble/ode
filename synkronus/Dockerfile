# Multi-stage build for Synkronus
# Stage 1: Build the Go application
FROM golang:1.24.2-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
# CGO is required for SQLite support (mattn/go-sqlite3)
ARG TARGETARCH
RUN CGO_ENABLED=1 GOOS=linux GOARCH=${TARGETARCH} go build -a -installsuffix cgo -o synkronus ./cmd/synkronus

# Stage 2: Create minimal runtime image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user for security
RUN addgroup -g 1000 synkronus && \
    adduser -D -u 1000 -G synkronus synkronus

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/synkronus .

# Create directories for data storage with proper permissions
RUN mkdir -p /app/data/app-bundles && \
    chown -R synkronus:synkronus /app

# Switch to non-root user
USER synkronus

# Expose port (default 8080, configurable via PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./synkronus"]
