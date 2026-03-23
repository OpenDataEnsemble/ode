package utils

import "strings"

// EnsureScheme prepends https:// to the URL if it has no scheme (http:// or https://).
// Used so users can set api.url to "misha.synkronus.cloud" and the CLI still works.
func EnsureScheme(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	if strings.HasPrefix(raw, "https://") || strings.HasPrefix(raw, "http://") {
		return raw
	}
	return "https://" + raw
}

// NormalizeURL trims trailing slashes from a URL string (after EnsureScheme).
func NormalizeURL(raw string) string {
	return strings.TrimRight(EnsureScheme(raw), "/")
}

// APIBaseURL returns the base URL for Synkronus HTTP API routes in openapi/synkronus.yaml,
// which are all under the /api prefix from the deployment origin.
// If the configured URL already ends with /api, it is left unchanged so paths are not doubled.
func APIBaseURL(raw string) string {
	base := NormalizeURL(raw)
	if base == "" {
		return base
	}
	if strings.HasSuffix(strings.ToLower(base), "/api") {
		return base
	}
	return base + "/api"
}

// OriginURL strips a trailing /api segment (case-insensitive) so callers can reach routes
// served at the site root, e.g. GET /health in the OpenAPI spec.
func OriginURL(raw string) string {
	base := NormalizeURL(raw)
	if base == "" {
		return base
	}
	lower := strings.ToLower(base)
	if strings.HasSuffix(lower, "/api") {
		return strings.TrimRight(base[:len(base)-len("/api")], "/")
	}
	return base
}
