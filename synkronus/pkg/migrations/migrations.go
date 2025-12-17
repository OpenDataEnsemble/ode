package migrations

import (
	"embed"
	"io/fs"
)

//go:embed sql/*.sql
var migrationFS embed.FS

// GetFS returns the embedded filesystem containing migration files
func GetFS() fs.FS {
	subFS, err := fs.Sub(migrationFS, "sql")
	if err != nil {
		panic(err)
	}
	return subFS
}
