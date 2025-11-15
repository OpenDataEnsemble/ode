package main

import (
	"os"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		// The error will be printed by Cobra, so we don't need to print it here
		// Just exit with non-zero status
		os.Exit(1)
	}
}
