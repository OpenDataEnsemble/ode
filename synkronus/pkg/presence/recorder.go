package presence

import (
	"context"
	"sync"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
)

// RecorderDB is implemented by the presence repository for async writes.
type RecorderDB interface {
	Upsert(ctx context.Context, username, clientID string, lastSeenAt time.Time, lastDataVersion *int64, appBundleVersion, lastOdeVersion *string) error
}

// Config controls the async presence recorder.
type Config struct {
	ThrottleInterval time.Duration // applies only when Event.SkipThrottle is false
	QueueSize        int
	Workers          int
	DBWriteTimeout   time.Duration
}

// DefaultConfig returns sensible defaults for production.
func DefaultConfig() Config {
	return Config{
		ThrottleInterval: 30 * time.Second,
		QueueSize:        2048,
		Workers:          2,
		DBWriteTimeout:   5 * time.Second,
	}
}

// Event is one presence write (may be throttled before enqueue).
type Event struct {
	Username         string
	ClientID         string
	LastSeen         time.Time
	LastDataVersion  *int64
	AppBundleVersion *string
	LastOdeVersion   *string
	// SkipThrottle: true for sync pull/push and app-bundle hooks so version fields are not dropped.
	SkipThrottle bool
}

// Recorder throttles, enqueues, and writes presence asynchronously.
type Recorder struct {
	repo  RecorderDB
	log   *logger.Logger
	cfg   Config
	queue chan Event
	wg    sync.WaitGroup
	close sync.Once

	mu       sync.Mutex
	lastSent map[string]time.Time // key: username + "\x00" + clientID; updated after successful enqueue
}

// NewRecorder starts worker goroutines. Call Shutdown on process exit.
func NewRecorder(repo RecorderDB, log *logger.Logger, cfg Config) *Recorder {
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 2048
	}
	if cfg.Workers <= 0 {
		cfg.Workers = 2
	}
	if cfg.DBWriteTimeout <= 0 {
		cfg.DBWriteTimeout = 5 * time.Second
	}
	if cfg.ThrottleInterval <= 0 {
		cfg.ThrottleInterval = 30 * time.Second
	}
	r := &Recorder{
		repo:     repo,
		log:      log,
		cfg:      cfg,
		queue:    make(chan Event, cfg.QueueSize),
		lastSent: make(map[string]time.Time),
	}
	for i := 0; i < cfg.Workers; i++ {
		r.wg.Add(1)
		go r.worker(i)
	}
	return r
}

func throttleKey(username, clientID string) string {
	return username + "\x00" + clientID
}

// Enqueue applies throttle (unless SkipThrottle), then non-blocking send to queue.
func (r *Recorder) Enqueue(ev Event) {
	if ev.Username == "" {
		return
	}
	if ev.ClientID == "" {
		ev.ClientID = ""
	}
	if ev.LastSeen.IsZero() {
		ev.LastSeen = time.Now().UTC()
	} else {
		ev.LastSeen = ev.LastSeen.UTC()
	}

	if !ev.SkipThrottle {
		key := throttleKey(ev.Username, ev.ClientID)
		now := time.Now()
		r.mu.Lock()
		if last, ok := r.lastSent[key]; ok && now.Sub(last) < r.cfg.ThrottleInterval {
			r.mu.Unlock()
			return
		}
		r.mu.Unlock()
	}

	select {
	case r.queue <- ev:
		if !ev.SkipThrottle {
			key := throttleKey(ev.Username, ev.ClientID)
			r.mu.Lock()
			r.lastSent[key] = time.Now()
			r.mu.Unlock()
		}
	default:
		r.log.Warn("presence queue full, dropping event", "username", ev.Username, "clientId", ev.ClientID)
	}
}

// Shutdown drains best-effort: workers stop after channel close; in-flight DB writes may be lost.
func (r *Recorder) Shutdown(ctx context.Context) {
	r.close.Do(func() {
		close(r.queue)
	})
	done := make(chan struct{})
	go func() {
		r.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

func (r *Recorder) worker(id int) {
	defer r.wg.Done()
	for ev := range r.queue {
		wctx, cancel := context.WithTimeout(context.Background(), r.cfg.DBWriteTimeout)
		err := r.repo.Upsert(wctx, ev.Username, ev.ClientID, ev.LastSeen, ev.LastDataVersion, ev.AppBundleVersion, ev.LastOdeVersion)
		cancel()
		if err != nil {
			r.log.Error("presence worker upsert failed", "worker", id, "error", err, "username", ev.Username, "clientId", ev.ClientID)
		}
	}
}
