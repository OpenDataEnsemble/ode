package stats

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Database reads observation aggregates for stats endpoints.
type Database interface {
	GetFormTypeCounts(ctx context.Context) ([]FormTypeCount, error)
	GetDailyCounts(ctx context.Context) ([]DayCount, error)
}

type postgresDB struct {
	db *sql.DB
}

// NewPostgresDB creates a PostgreSQL-backed stats database adapter.
func NewPostgresDB(db *sql.DB) Database {
	return &postgresDB{db: db}
}

func (p *postgresDB) GetFormTypeCounts(ctx context.Context) ([]FormTypeCount, error) {
	query := `
		SELECT COALESCE(NULLIF(TRIM(form_type), ''), '(no form type)') AS form_type,
		       COUNT(*)::bigint AS count
		FROM observations
		WHERE deleted = false
		GROUP BY 1
		ORDER BY LOWER(COALESCE(NULLIF(TRIM(form_type), ''), '(no form type)'))
	`

	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query form type counts: %w", err)
	}
	defer rows.Close()

	var out []FormTypeCount
	for rows.Next() {
		var row FormTypeCount
		if err := rows.Scan(&row.FormType, &row.Count); err != nil {
			return nil, fmt.Errorf("scan form type count: %w", err)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate form type counts: %w", err)
	}
	if out == nil {
		out = []FormTypeCount{}
	}
	return out, nil
}

func (p *postgresDB) GetDailyCounts(ctx context.Context) ([]DayCount, error) {
	query := `
		SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
		       COUNT(*)::bigint AS count
		FROM observations
		WHERE deleted = false
		GROUP BY 1
		ORDER BY 1
	`

	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query daily counts: %w", err)
	}
	defer rows.Close()

	var out []DayCount
	for rows.Next() {
		var day time.Time
		var count int64
		if err := rows.Scan(&day, &count); err != nil {
			return nil, fmt.Errorf("scan daily count: %w", err)
		}
		day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)
		out = append(out, DayCount{Date: day, Count: count})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate daily counts: %w", err)
	}
	if out == nil {
		out = []DayCount{}
	}
	return out, nil
}
