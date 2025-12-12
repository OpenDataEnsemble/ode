package cmd

import (
	"fmt"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

// dataCmd represents the data command group
var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "Data-related operations",
	Long:  `Commands for working with exported data and statistics.`,
}

// dataExportCmd represents the data export command
var dataExportCmd = &cobra.Command{
	Use:   "export <output_file>",
	Short: "Export data as a Parquet ZIP archive",
	Long: `Download a ZIP archive of Parquet exports from the Synkronus API.

Examples:
  synk data export exports.zip
  synk data export ./backups/observations_parquet.zip`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		outputFile := args[0]

		if outputFile == "" {
			return fmt.Errorf("output_file is required")
		}

		c := client.NewClient()
		if err := c.DownloadParquetExport(outputFile); err != nil {
			return fmt.Errorf("data export failed: %w", err)
		}

		fmt.Printf("Parquet export saved to %s\n", outputFile)
		return nil
	},
}

func init() {
	dataCmd.AddCommand(dataExportCmd)
	rootCmd.AddCommand(dataCmd)
}
