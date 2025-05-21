package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/HelloSapiens/collectivus/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

func init() {
	// App Bundle command group
	appBundleCmd := &cobra.Command{
		Use:   "app-bundle",
		Short: "Manage app bundles",
		Long:  `Commands for managing app bundles in the Synkronus API.`,
	}
	rootCmd.AddCommand(appBundleCmd)

	// Get manifest command
	manifestCmd := &cobra.Command{
		Use:   "manifest",
		Short: "Get app bundle manifest",
		Long:  `Retrieve the current app bundle manifest from the Synkronus API.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewClient()
			manifest, err := c.GetAppBundleManifest()
			if err != nil {
				return fmt.Errorf("failed to get app bundle manifest: %w", err)
			}

			// Format output as JSON
			jsonOutput, err := cmd.Flags().GetBool("json")
			if err != nil {
				return err
			}

			if jsonOutput {
				jsonData, err := json.MarshalIndent(manifest, "", "  ")
				if err != nil {
					return fmt.Errorf("error formatting JSON: %w", err)
				}
				fmt.Println(string(jsonData))
				return nil
			}

			// Display formatted output
			fmt.Println("App Bundle Manifest:")
			fmt.Printf("Version: %s\n", manifest["version"])
			fmt.Printf("Generated At: %s\n", manifest["generatedAt"])
			fmt.Printf("Hash: %s\n", manifest["hash"])

			files, ok := manifest["files"].([]interface{})
			if ok {
				fmt.Printf("Files: %d\n", len(files))
				for i, file := range files {
					if i >= 5 && !cmd.Flags().Changed("all") {
						fmt.Printf("... and %d more files (use --all to show all)\n", len(files)-5)
						break
					}

					fileMap, ok := file.(map[string]interface{})
					if ok {
						fmt.Printf("  - %s (%d bytes)\n", fileMap["path"], int(fileMap["size"].(float64)))
					}
				}
			}

			return nil
		},
	}
	manifestCmd.Flags().BoolP("json", "j", false, "Output in JSON format")
	manifestCmd.Flags().Bool("all", false, "Show all files in manifest")
	appBundleCmd.AddCommand(manifestCmd)

	// Get versions command
	versionsCmd := &cobra.Command{
		Use:   "versions",
		Short: "List app bundle versions",
		Long:  `List all available app bundle versions from the Synkronus API.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewClient()
			response, err := c.GetAppBundleVersions()
			if err != nil {
				return fmt.Errorf("failed to get app bundle versions: %w", err)
			}

			// Format output as JSON
			jsonOutput, err := cmd.Flags().GetBool("json")
			if err != nil {
				return err
			}

			if jsonOutput {
				jsonData, err := json.MarshalIndent(response, "", "  ")
				if err != nil {
					return fmt.Errorf("error formatting JSON: %w", err)
				}
				fmt.Println(string(jsonData))
				return nil
			}

			// Display formatted output
			fmt.Println("Available App Bundle Versions:")
			versions, ok := response["versions"].([]interface{})
			if ok {
				for _, version := range versions {
					fmt.Printf("- %s\n", version)
				}
			} else {
				fmt.Println("No versions found")
			}

			return nil
		},
	}
	versionsCmd.Flags().BoolP("json", "j", false, "Output in JSON format")
	appBundleCmd.AddCommand(versionsCmd)

	// Download command
	downloadCmd := &cobra.Command{
		Use:   "download [path]",
		Short: "Download app bundle files",
		Long: `Download files from the app bundle to a local directory.

Use the --preview flag to ensure you get the preview version of the app bundle.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewClient()

			// Get manifest first
			manifest, err := c.GetAppBundleManifest()
			if err != nil {
				return fmt.Errorf("failed to get app bundle manifest: %w", err)
			}

			// Determine output directory
			outputDir, err := cmd.Flags().GetString("output")
			if err != nil {
				return err
			}

			if outputDir == "" {
				outputDir = "app-bundle"
			}

			// Create output directory if it doesn't exist
			if err := os.MkdirAll(outputDir, 0755); err != nil {
				return fmt.Errorf("error creating output directory: %w", err)
			}

			// Filter by specific path if provided
			filterPath := ""
			if len(args) > 0 {
				filterPath = args[0]
			}

			// Download files
			files, ok := manifest["files"].([]interface{})
			if !ok {
				return fmt.Errorf("invalid manifest format")
			}

			downloadCount := 0
			for _, file := range files {
				fileMap, ok := file.(map[string]interface{})
				if !ok {
					continue
				}

				filePath, ok := fileMap["path"].(string)
				if !ok {
					continue
				}

				// Skip if not matching filter
				if filterPath != "" && filePath != filterPath {
					continue
				}

				// Download file
				destPath := filepath.Join(outputDir, filePath)
				fmt.Printf("Downloading %s...\n", filePath)

				preview, _ := cmd.Flags().GetBool("preview")
				if err := c.DownloadAppBundleFile(filePath, destPath, preview); err != nil {
					return fmt.Errorf("error downloading %s: %w", filePath, err)
				}

				downloadCount++

				// If specific file was requested, stop after downloading it
				if filterPath != "" {
					break
				}
			}

			fmt.Printf("Downloaded %d files to %s\n", downloadCount, outputDir)
			return nil
		},
	}
	downloadCmd.Flags().StringP("output", "o", "", "Output directory for downloaded files")
	downloadCmd.Flags().Bool("preview", false, "Download the preview (or latest version if no preview exists) version of the app bundle")
	appBundleCmd.AddCommand(downloadCmd)

	// Upload command
	uploadCmd := &cobra.Command{
		Use:   "upload [file]",
		Short: "Upload a new app bundle",
		Long:  `Upload a new app bundle ZIP file to the Synkronus API (admin only).`,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bundlePath := args[0]

			// Check if file exists
			if _, err := os.Stat(bundlePath); os.IsNotExist(err) {
				return fmt.Errorf("file not found: %s", bundlePath)
			}

			c := client.NewClient()
			response, err := c.UploadAppBundle(bundlePath)
			if err != nil {
				return fmt.Errorf("failed to upload app bundle: %w", err)
			}

			fmt.Println("App bundle uploaded successfully!")
			fmt.Printf("Message: %s\n", response["message"])

			return nil
		},
	}
	appBundleCmd.AddCommand(uploadCmd)

	// Switch version command
	switchCmd := &cobra.Command{
		Use:   "switch [version]",
		Short: "Switch to a specific app bundle version",
		Long:  `Switch to a specific app bundle version on the server (admin only).`,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			version := args[0]

			c := client.NewClient()
			response, err := c.SwitchAppBundleVersion(version)
			if err != nil {
				return fmt.Errorf("failed to switch app bundle version: %w", err)
			}

			fmt.Println("App bundle version switched successfully!")
			fmt.Printf("Message: %s\n", response["message"])

			return nil
		},
	}
	appBundleCmd.AddCommand(switchCmd)
}
