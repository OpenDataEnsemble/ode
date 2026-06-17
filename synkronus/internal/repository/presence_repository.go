package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/database"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// PresenceRepository persists per-user per-client presence rows.
type PresenceRepository struct {
	db  *database.Database
	log *logger.Logger
}

// NewPresenceRepository creates a PresenceRepository.
func NewPresenceRepository(db *database.Database, log *logger.Logger) *PresenceRepository {
	return &PresenceRepository{db: db, log: log}
}

// Upsert merges a presence row (async worker path).
func (r *PresenceRepository) Upsert(ctx context.Context, username, clientID string, lastSeenAt time.Time, lastDataVersion *int64, appBundleVersion, lastOdeVersion *string) error {
	if clientID == "" {
		clientID = ""
	}
	q := `
INSERT INTO user_client_presence (username, client_id, last_seen_at, last_data_version, app_bundle_version, last_ode_version)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (username, client_id) DO UPDATE SET
	last_seen_at = GREATEST(user_client_presence.last_seen_at, EXCLUDED.last_seen_at),
	last_data_version = COALESCE(EXCLUDED.last_data_version, user_client_presence.last_data_version),
	app_bundle_version = COALESCE(EXCLUDED.app_bundle_version, user_client_presence.app_bundle_version),
	last_ode_version = COALESCE(EXCLUDED.last_ode_version, user_client_presence.last_ode_version)
`
	_, err := r.db.DB().ExecContext(ctx, q, username, clientID, lastSeenAt, lastDataVersion, appBundleVersion, lastOdeVersion)
	if err != nil {
		return fmt.Errorf("presence upsert: %w", err)
	}
	return nil
}

// ListByUsernames returns all presence rows for the given usernames (admin list enrichment).
func (r *PresenceRepository) ListByUsernames(ctx context.Context, usernames []string) (map[string][]models.UserPresenceClient, error) {
	if len(usernames) == 0 {
		return map[string][]models.UserPresenceClient{}, nil
	}
	q := `
SELECT username, client_id, last_seen_at, last_data_version, app_bundle_version, last_ode_version
FROM user_client_presence
WHERE username = ANY($1)
ORDER BY username, client_id
`
	rows, err := r.db.DB().QueryContext(ctx, q, pq.Array(usernames))
	if err != nil {
		return nil, fmt.Errorf("presence list: %w", err)
	}
	defer rows.Close()

	out := make(map[string][]models.UserPresenceClient)
	for rows.Next() {
		var (
			uname, clientID string
			lastSeen        time.Time
			lastDV          sql.NullInt64
			appV, odeV      sql.NullString
		)
		if err := rows.Scan(&uname, &clientID, &lastSeen, &lastDV, &appV, &odeV); err != nil {
			return nil, fmt.Errorf("presence scan: %w", err)
		}
		c := models.UserPresenceClient{
			ClientID:   clientID,
			LastSeenAt: lastSeen,
		}
		if lastDV.Valid {
			v := lastDV.Int64
			c.LastDataVersion = &v
		}
		if appV.Valid {
			s := appV.String
			c.AppBundleVersion = &s
		}
		if odeV.Valid {
			s := odeV.String
			c.LastOdeVersion = &s
		}
		out[uname] = append(out[uname], c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
