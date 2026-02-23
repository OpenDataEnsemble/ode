package portal

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// Handler returns an http.Handler that serves the embedded portal with SPA
// fallback: if the requested path is not found, index.html is served so
// client-side routing works.
func Handler() http.Handler {
	// Root of the embedded FS is "dist"; sub to get content as root.
	root, _ := fs.Sub(distFS, "dist")
	fileServer := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "" || p == "/" {
			p = "/index.html"
		}
		p = strings.TrimPrefix(p, "/")
		p = path.Clean(p)
		if p == "." {
			p = "index.html"
		}
		f, err := root.Open(p)
		if err == nil {
			defer f.Close()
			stat, _ := f.Stat()
			if stat != nil && !stat.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		// SPA fallback: serve index.html so the client router can handle the path.
		// If index.html is missing from the embed (e.g. broken Docker build), serve a minimal fallback so GET / never 404s.
		if f, err := root.Open("index.html"); err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(fallbackIndexHTML))
			return
		} else {
			f.Close()
		}
		r.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, r)
	})
}

// fallbackIndexHTML is served when the embedded dist has no index.html (e.g. broken build).
// Ensures GET / never returns 404 so the published image always serves something at /.
const fallbackIndexHTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Synkronus</title></head><body><p>Synkronus portal. If you see this, the embedded portal build may be missing; pull the latest image or rebuild.</p></body></html>`
