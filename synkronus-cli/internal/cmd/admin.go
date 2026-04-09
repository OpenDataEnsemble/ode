package cmd

import (
	"fmt"
	"os"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

func init() {
	adminCmd := &cobra.Command{
		Use:   "admin",
		Short: "Privileged server operations (requires admin JWT)",
		Long:  `Commands that mutate server-wide state. Authenticate with an admin account (synk login) first.`,
	}

	repositoryResetCmd := &cobra.Command{
		Use:   "repository-reset",
		Short: "Irreversibly wipe server observation and attachment sync data",
		Long: `Destructive: deletes all observations and attachment manifest rows, resets the observation stream,
increments repository_generation, and clears attachment files under the server's data directory.
App bundles are not removed.

You must pass --confirm=RESET_REPOSITORY exactly. Requires admin role.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			confirm, err := cmd.Flags().GetString("confirm")
			if err != nil {
				return err
			}
			if confirm != "RESET_REPOSITORY" {
				return fmt.Errorf(`refusing to run: set --confirm=RESET_REPOSITORY (exact string) to authorize this irreversible operation`)
			}

			c := client.NewClient()
			resp, err := c.AdminRepositoryReset()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Repository reset failed: %v\n", err)
				os.Exit(1)
				return nil
			}
			fmt.Printf("Repository reset complete.\n")
			fmt.Printf("repository_generation: %d\n", resp.RepositoryGeneration)
			fmt.Printf("%s\n", resp.Message)
			return nil
		},
	}
	repositoryResetCmd.Flags().String("confirm", "", `Must be exactly RESET_REPOSITORY`)
	_ = repositoryResetCmd.MarkFlagRequired("confirm")

	adminCmd.AddCommand(repositoryResetCmd)
	rootCmd.AddCommand(adminCmd)
}
