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
		r.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, r)
	})
}
