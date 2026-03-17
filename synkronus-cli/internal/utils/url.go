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
