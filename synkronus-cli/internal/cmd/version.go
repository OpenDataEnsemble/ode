package cmd

import (
	"fmt"
	"time"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client"
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
		Short: "Print version information",
		Long:  `Display version information for both the CLI and the connected Synkronus server.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Print CLI version first
			utils.PrintHeading("CLI Version")
			printCLIVersion()

			// Print server version if connected
			utils.PrintHeading("\nServer Version")
			return printServerVersion()
		},
	}
	rootCmd.AddCommand(versionCmd)
}

// printCLIVersion prints the CLI version information
func printCLIVersion() {
	fmt.Printf("%s\n", utils.FormatKeyValue("Version", utils.Info("v"+Version)))
	fmt.Printf("%s\n", utils.FormatKeyValue("Build date", BuildDate))
	fmt.Printf("%s\n", utils.FormatKeyValue("Commit", CommitHash))
}

// printServerVersion fetches and prints the server version information
func printServerVersion() error {
	c := client.NewClient()
	start := time.Now()

	versionInfo, err := c.GetVersion()
	if err != nil {
		utils.PrintError("Failed to get server version: %v", err)
		return nil
	}

	duration := time.Since(start)
	respTimeStr := formatResponseTime(duration)

	// Print server version details
	fmt.Printf("%s\n", utils.FormatKeyValue("Server version", utils.Info(versionInfo.Server.Version)))
	fmt.Printf("%s\n", utils.FormatKeyValue("Database",
		fmt.Sprintf("%s %s", versionInfo.Database.Type, versionInfo.Database.Version)))
	fmt.Printf("%s\n", utils.FormatKeyValue("System",
		fmt.Sprintf("%s/%s (%d CPUs)", versionInfo.System.OS, versionInfo.System.Architecture, versionInfo.System.CPUs)))
	fmt.Printf("%s\n", utils.FormatKeyValue("Go version", versionInfo.Build.GoVersion))
	fmt.Printf("%s\n", utils.FormatKeyValue("Build commit", versionInfo.Build.Commit))
	fmt.Printf("%s\n", utils.FormatKeyValue("Build time", versionInfo.Build.BuildTime))
	fmt.Printf("%s\n", utils.FormatKeyValue("Response time", respTimeStr))

	return nil
}

// formatResponseTime formats the response time with appropriate color
func formatResponseTime(duration time.Duration) string {
	durationMS := float64(duration.Microseconds()) / 1000
	switch {
	case duration < 100*time.Millisecond:
		return utils.Success(fmt.Sprintf("%.1fms", durationMS))
	case duration < 500*time.Millisecond:
		return utils.Info(fmt.Sprintf("%.1fms", durationMS))
	case duration < 1*time.Second:
		return utils.Warning(fmt.Sprintf("%.1fms", durationMS))
	default:
		return utils.Error(fmt.Sprintf("%.1fms", durationMS))
	}
}
