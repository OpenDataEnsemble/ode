package auth

import (
	"context"
	"errors"
)

type contextKey string

const (
	claimsContextKey contextKey = "claims"
)

// ErrNoClaimsInContext is returned when no claims are found in the context
var ErrNoClaimsInContext = errors.New("no claims in context")

// WithClaims adds JWT claims to the context
func WithClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// ClaimsFromContext retrieves JWT claims from the context
func ClaimsFromContext(ctx context.Context) (*Claims, error) {
	claims, ok := ctx.Value(claimsContextKey).(*Claims)
	if !ok {
		return nil, ErrNoClaimsInContext
	}
	return claims, nil
}
