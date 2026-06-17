package presence

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/stretchr/testify/require"
)

type spyDB struct {
	calls atomic.Int32
}

func (s *spyDB) Upsert(ctx context.Context, username, clientID string, lastSeenAt time.Time, lastDataVersion *int64, appBundleVersion, lastOdeVersion *string) error {
	s.calls.Add(1)
	return nil
}

func TestRecorder_ThrottleHeartbeats(t *testing.T) {
	log := logger.NewLogger(logger.WithLevel(logger.LevelError))
	spy := &spyDB{}
	cfg := DefaultConfig()
	cfg.ThrottleInterval = time.Hour
	cfg.QueueSize = 64
	cfg.Workers = 1
	r := NewRecorder(spy, log, cfg)
	defer r.Shutdown(context.Background())

	r.Enqueue(Event{Username: "u1", ClientID: "c1", SkipThrottle: false})
	r.Enqueue(Event{Username: "u1", ClientID: "c1", SkipThrottle: false})
	time.Sleep(50 * time.Millisecond)
	require.EqualValues(t, 1, spy.calls.Load())
}

func TestRecorder_SkipThrottleAllowsBurst(t *testing.T) {
	log := logger.NewLogger(logger.WithLevel(logger.LevelError))
	spy := &spyDB{}
	cfg := DefaultConfig()
	cfg.ThrottleInterval = time.Hour
	cfg.QueueSize = 64
	cfg.Workers = 2
	r := NewRecorder(spy, log, cfg)
	defer r.Shutdown(context.Background())

	v := int64(1)
	r.Enqueue(Event{Username: "u1", ClientID: "c1", LastDataVersion: &v, SkipThrottle: true})
	r.Enqueue(Event{Username: "u1", ClientID: "c1", LastDataVersion: &v, SkipThrottle: true})
	time.Sleep(100 * time.Millisecond)
	require.EqualValues(t, 2, spy.calls.Load())
}

func TestRecorder_QueueFullDrops(t *testing.T) {
	log := logger.NewLogger(logger.WithLevel(logger.LevelError))
	block := make(chan struct{})
	spy := &slowDB{block: block}
	cfg := DefaultConfig()
	cfg.QueueSize = 1
	cfg.Workers = 1
	cfg.DBWriteTimeout = time.Second
	r := NewRecorder(spy, log, cfg)

	r.Enqueue(Event{Username: "u1", ClientID: "a", SkipThrottle: true})
	time.Sleep(20 * time.Millisecond)
	r.Enqueue(Event{Username: "u1", ClientID: "b", SkipThrottle: true})
	r.Enqueue(Event{Username: "u1", ClientID: "c", SkipThrottle: true})
	close(block)
	r.Shutdown(context.Background())
	require.EqualValues(t, 2, spy.calls.Load())
}

type slowDB struct {
	block chan struct{}
	calls atomic.Int32
}

func (s *slowDB) Upsert(ctx context.Context, username, clientID string, lastSeenAt time.Time, lastDataVersion *int64, appBundleVersion, lastOdeVersion *string) error {
	if s.block != nil {
		<-s.block
	}
	s.calls.Add(1)
	return nil
}
