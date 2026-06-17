package models

import (
	"time"

	"github.com/google/uuid"
)

// UserPresenceClient is per-client presence for admin user listing.
type UserPresenceClient struct {
	ClientID         string    `json:"clientId"`
	LastSeenAt       time.Time `json:"lastSeenAt"`
	LastDataVersion  *int64    `json:"lastDataVersion,omitempty"`
	AppBundleVersion *string   `json:"appBundleVersion,omitempty"`
	LastOdeVersion   *string   `json:"lastOdeVersion,omitempty"`
}

// UserPresenceSummary aggregates presence for one user (admin list).
type UserPresenceSummary struct {
	LastSeenAt  *time.Time           `json:"lastSeenAt,omitempty"`
	Clients     []UserPresenceClient `json:"clients,omitempty"`
	ClientCount int                  `json:"clientCount,omitempty"`
}

// UserListItem is one row in GET /api/users (admin). Omits password.
type UserListItem struct {
	ID        uuid.UUID            `json:"id"`
	Username  string               `json:"username"`
	Role      Role                 `json:"role"`
	CreatedAt time.Time            `json:"createdAt"`
	UpdatedAt time.Time            `json:"updatedAt"`
	Presence  *UserPresenceSummary `json:"presence,omitempty"`
}

// NewUserPresenceSummary builds an aggregated summary for admin listing.
func NewUserPresenceSummary(clients []UserPresenceClient) *UserPresenceSummary {
	if len(clients) == 0 {
		return nil
	}
	var max *time.Time
	for i := range clients {
		c := &clients[i]
		if max == nil || c.LastSeenAt.After(*max) {
			t := c.LastSeenAt
			max = &t
		}
	}
	return &UserPresenceSummary{
		LastSeenAt:  max,
		Clients:     clients,
		ClientCount: len(clients),
	}
}
