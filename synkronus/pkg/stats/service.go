package stats

import (
	"context"
	"fmt"
	"time"
)

// Service computes observation dashboard aggregates.
type Service interface {
	GetObservationStats(ctx context.Context) (*ObservationStats, error)
}

type service struct {
	db Database
}

// NewService creates a stats service.
func NewService(db Database) Service {
	return &service{db: db}
}

func (s *service) GetObservationStats(ctx context.Context) (*ObservationStats, error) {
	byFormType, err := s.db.GetFormTypeCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("form type counts: %w", err)
	}

	var total int64
	for _, row := range byFormType {
		total += row.Count
	}

	days, err := s.db.GetDailyCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("daily counts: %w", err)
	}

	return &ObservationStats{
		TotalCount: total,
		ByFormType: byFormType,
		Timeline:   BuildTimeline(days),
		ComputedAt: time.Now().UTC(),
	}, nil
}
