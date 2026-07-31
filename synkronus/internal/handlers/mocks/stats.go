package mocks

import (
	"context"

	"github.com/opendataensemble/synkronus/pkg/stats"
)

// MockStatsService is a mock implementation of stats.Service.
type MockStatsService struct {
	Result *stats.ObservationStats
	Err    error
}

// NewMockStatsService creates a new mock stats service.
func NewMockStatsService() *MockStatsService {
	return &MockStatsService{
		Result: &stats.ObservationStats{
			TotalCount: 0,
			ByFormType: []stats.FormTypeCount{},
			Timeline: stats.ObservationTimeline{
				BucketUnit: "day",
				Buckets:    []stats.TimelineBucket{},
			},
		},
	}
}

func (m *MockStatsService) GetObservationStats(ctx context.Context) (*stats.ObservationStats, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Result, nil
}

var _ stats.Service = (*MockStatsService)(nil)
