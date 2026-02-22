package portal

import "embed"

// dist is the embedded React portal build output (synkronus-portal/dist).
// At Docker build time, the real portal build is copied into portal/dist
// before running go build. For local builds without the portal, a minimal
// placeholder index.html is committed so the Go build succeeds.
//
//go:embed all:dist
var distFS embed.FS
