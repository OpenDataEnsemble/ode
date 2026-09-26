package authlimit

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	EndpointLogin   = "login"
	EndpointRefresh = "refresh"
)

type Config struct {
	MaxBodyBytes      int64
	MaxUsernameBytes  int
	MaxPasswordBytes  int
	MaxTokenBytes     int
	IPAttempts        int
	IPWindow          time.Duration
	LoginAttempts     int
	LoginWindow       time.Duration
	AccountAttempts   int
	AccountWindow     time.Duration
	MaxKeys           int
	TrustedProxyCIDRs []string
}

type bucket struct {
	count int
	reset time.Time
}

type windowLimiter struct {
	mu      sync.Mutex
	buckets map[string]bucket
	limit   int
	window  time.Duration
	maxKeys int
	now     func() time.Time
}

func newWindowLimiter(limit int, window time.Duration, maxKeys int) *windowLimiter {
	return &windowLimiter{buckets: make(map[string]bucket), limit: limit, window: window, maxKeys: maxKeys, now: time.Now}
}

func (l *windowLimiter) available(key string) (bool, time.Duration) {
	if l.limit <= 0 {
		return true, 0
	}
	now := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()
	l.cleanupExpired(now)
	b, ok := l.buckets[key]
	if !ok {
		return true, 0
	}
	if b.count >= l.limit {
		return false, time.Until(b.reset)
	}
	return true, 0
}

func (l *windowLimiter) take(key string) (bool, time.Duration) {
	if l.limit <= 0 {
		return true, 0
	}
	now := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()
	l.cleanupExpired(now)
	b, ok := l.buckets[key]
	if !ok {
		if l.maxKeys > 0 && len(l.buckets) >= l.maxKeys {
			return false, l.window
		}
		l.buckets[key] = bucket{count: 1, reset: now.Add(l.window)}
		return true, 0
	}
	if b.count >= l.limit {
		return false, b.reset.Sub(now)
	}
	b.count++
	l.buckets[key] = b
	return true, 0
}

func (l *windowLimiter) record(key string) {
	_, _ = l.take(key)
}

func (l *windowLimiter) cleanupExpired(now time.Time) {
	for key, b := range l.buckets {
		if !now.Before(b.reset) {
			delete(l.buckets, key)
		}
	}
}

type peerContextKey struct{}

// CapturePeer stores the socket peer before any middleware interprets forwarding headers.
func CapturePeer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), peerContextKey{}, parseRemoteIP(r.RemoteAddr))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type Guard struct {
	config       Config
	ipLimiter    *windowLimiter
	loginLimiter *windowLimiter
	acctLimiter  *windowLimiter
	trusted      []*net.IPNet
	hmacKey      []byte
}

func New(config Config) (*Guard, error) {
	trusted := make([]*net.IPNet, 0, len(config.TrustedProxyCIDRs))
	for _, raw := range config.TrustedProxyCIDRs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		_, network, err := net.ParseCIDR(raw)
		if err != nil {
			return nil, err
		}
		trusted = append(trusted, network)
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	return &Guard{
		config:       config,
		ipLimiter:    newWindowLimiter(config.IPAttempts, config.IPWindow, config.MaxKeys),
		loginLimiter: newWindowLimiter(config.LoginAttempts, config.LoginWindow, config.MaxKeys),
		acctLimiter:  newWindowLimiter(config.AccountAttempts, config.AccountWindow, config.MaxKeys),
		trusted:      trusted,
		hmacKey:      key,
	}, nil
}

type authInput struct {
	Username     string `json:"username"`
	Password     string `json:"password"`
	RefreshToken string `json:"refreshToken"`
}

func (g *Guard) Middleware(endpoint string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := g.clientIP(r)
			if ok, retry := g.ipLimiter.take("ip:" + ip); !ok {
				writeRateLimited(w, retry)
				return
			}

			body, err := readBoundedBody(w, r, g.config.MaxBodyBytes)
			if err != nil {
				var maxBytesError *http.MaxBytesError
				if errors.As(err, &maxBytesError) {
					writeJSONError(w, http.StatusRequestEntityTooLarge, "request_too_large", "Authentication request is too large")
					return
				}
				writeJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request format")
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))

			var input authInput
			_ = json.Unmarshal(body, &input) // The handler remains authoritative for JSON validation.
			if len(input.Username) > g.config.MaxUsernameBytes || len(input.Password) > g.config.MaxPasswordBytes || len(input.RefreshToken) > g.config.MaxTokenBytes {
				writeJSONError(w, http.StatusBadRequest, "invalid_request", "Authentication field is too long")
				return
			}

			var sourceIdentityKey, accountKey string
			if endpoint == EndpointLogin && input.Username != "" {
				identity := g.digest("username:" + input.Username)
				sourceIdentityKey = "login-source:" + ip + ":" + identity
				accountKey = "login-account:" + identity
				if ok, retry := g.loginLimiter.available(sourceIdentityKey); !ok {
					writeRateLimited(w, retry)
					return
				}
				if ok, retry := g.acctLimiter.available(accountKey); !ok {
					writeRateLimited(w, retry)
					return
				}
			}

			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			if recorder.status == http.StatusUnauthorized && sourceIdentityKey != "" {
				g.loginLimiter.record(sourceIdentityKey)
				g.acctLimiter.record(accountKey)
			}
		})
	}
}

func (g *Guard) digest(value string) string {
	mac := hmac.New(sha256.New, g.hmacKey)
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func (g *Guard) clientIP(r *http.Request) string {
	peer, _ := r.Context().Value(peerContextKey{}).(net.IP)
	if peer == nil {
		peer = parseRemoteIP(r.RemoteAddr)
	}
	if g.isTrusted(peer) {
		if forwarded := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); forwarded != nil {
			return forwarded.String()
		}
	}
	if peer == nil {
		return "unknown"
	}
	return peer.String()
}

func (g *Guard) isTrusted(ip net.IP) bool {
	for _, network := range g.trusted {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func parseRemoteIP(remote string) net.IP {
	host, _, err := net.SplitHostPort(remote)
	if err == nil {
		return net.ParseIP(strings.Trim(host, "[]"))
	}
	return net.ParseIP(strings.Trim(remote, "[]"))
}

func readBoundedBody(w http.ResponseWriter, r *http.Request, max int64) ([]byte, error) {
	if max <= 0 {
		max = 16 << 10
	}
	r.Body = http.MaxBytesReader(w, r.Body, max)
	return io.ReadAll(r.Body)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func writeRateLimited(w http.ResponseWriter, retry time.Duration) {
	seconds := int64((retry + time.Second - 1) / time.Second)
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.FormatInt(seconds, 10))
	writeJSONError(w, http.StatusTooManyRequests, "rate_limited", "Too many authentication attempts; try again later")
}

func writeJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": message})
}
