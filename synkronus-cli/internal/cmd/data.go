package cmd

import (
	"fmt"
	"strings"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

var dataExportFormat string

// dataCmd represents the data command group
var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "Data-related operations",
	Long:  `Commands for working with exported data and statistics.`,
}

// dataExportCmd represents the data export command
var dataExportCmd = &cobra.Command{
	Use:   "export <output_file>",
	Short: "Export observations or attachments as a ZIP archive",
	Long: `Download a ZIP archive from the Synkronus API.

Use --format to choose the export (default: parquet).

Examples:
  synk data export exports.zip
  synk data export --format parquet ./backups/observations_parquet.zip
  synk data export --format json observations_raw.zip
  synk data export --format attachments attachments.zip`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		outputFile := args[0]

		if outputFile == "" {
			return fmt.Errorf("output_file is required")
		}

		c := client.NewClient()
		format := strings.ToLower(strings.TrimSpace(dataExportFormat))
		if format == "" {
			format = "parquet"
		}

		var err error
		var label string
		switch format {
		case "parquet":
			err = c.DownloadParquetExport(outputFile)
			label = "Parquet"
		case "json", "raw-json":
			err = c.DownloadRawJSONExport(outputFile)
			label = "Raw JSON"
		case "attachments":
			err = c.DownloadAttachmentsExport(outputFile)
			label = "Attachments"
		default:
			return fmt.Errorf("unknown --format %q (use parquet, json, or attachments)", dataExportFormat)
		}

		if err != nil {
			return fmt.Errorf("data export failed: %w", err)
		}

		fmt.Printf("%s export saved to %s\n", label, outputFile)
		return nil
	},
}

func init() {
	dataExportCmd.Flags().StringVarP(&dataExportFormat, "format", "f", "parquet", "Export format: parquet, json (raw per-observation JSON), or attachments (all files ZIP)")
	_ = dataExportCmd.RegisterFlagCompletionFunc("format", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		formats := []string{"parquet", "json", "raw-json", "attachments"}
		return formats, cobra.ShellCompDirectiveNoFileComp
	})
	dataCmd.AddCommand(dataExportCmd)
	rootCmd.AddCommand(dataCmd)
}
