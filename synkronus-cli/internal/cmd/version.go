package cmd

import (
	"fmt"

	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/utils"
	"github.com/spf13/cobra"
)

var (
	// Version is the CLI version, set during build
	Version = "0.1.0"
	// BuildDate is the date when the CLI was built
	BuildDate = "unknown"
	// CommitHash is the git commit hash
	CommitHash = "unknown"
)

func init() {
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version number of Synkronus CLI",
		Long:  `Display the version, build date, and commit hash of the Synkronus CLI.`,
		Run: func(cmd *cobra.Command, args []string) {
			utils.PrintHeading("Synkronus CLI")
			fmt.Printf("%s\n", utils.FormatKeyValue("Version", utils.Info("v"+Version)))
			fmt.Printf("%s\n", utils.FormatKeyValue("Build date", BuildDate))
			fmt.Printf("%s\n", utils.FormatKeyValue("Commit", CommitHash))
		},
	}
	rootCmd.AddCommand(versionCmd)
}
