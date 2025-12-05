package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/validation"
	"github.com/fatih/color"
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
				cmd.SilenceUsage = true
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
					cmd.SilenceUsage = true
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
				cmd.SilenceUsage = true
				return err
			}

			// Format output as JSON
			jsonOutput, err := cmd.Flags().GetBool("json")
			if err != nil {
				return err
			}

			if jsonOutput {
				jsonData, err := json.MarshalIndent(response, "", "  ")
				if err != nil {
					return err
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
				cmd.SilenceUsage = true
				return err
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
				cmd.SilenceUsage = true
				return err
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
				err = c.DownloadAppBundleFile(filePath, destPath, preview)
				if err != nil {
					cmd.SilenceUsage = true
					return err
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
		Long: `Upload a new app bundle ZIP file to the Synkronus API (admin only).

The bundle will be validated before upload to ensure it has the correct structure.
Use --skip-validation to bypass validation (not recommended).

After upload, use --activate to automatically activate the new version.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bundlePath := args[0]

			// Check if file exists
			if _, err := os.Stat(bundlePath); os.IsNotExist(err) {
				cmd.SilenceUsage = true
				return fmt.Errorf("file not found: %s: %w", bundlePath, err)
			}

			// Get flags
			skipValidation, _ := cmd.Flags().GetBool("skip-validation")
			activate, _ := cmd.Flags().GetBool("activate")
			verbose, _ := cmd.Flags().GetBool("verbose")

			// Validate bundle structure (unless skipped)
			if !skipValidation {
				color.Cyan("Validating bundle structure...")
				if err := validation.ValidateBundle(bundlePath); err != nil {
					cmd.SilenceUsage = true
					return fmt.Errorf("bundle validation failed: %w", err)
				}
				color.Green("✓ Bundle structure is valid")
			} else {
				color.Yellow("⚠ Skipping validation (not recommended)")
			}

			// Show bundle info
			if verbose {
				info, err := validation.GetBundleInfo(bundlePath)
				if err == nil {
					fmt.Println()
					color.Cyan("Bundle Information:")
					fmt.Printf("  Size: %d bytes\n", info["size"])
					fmt.Printf("  Files: %d\n", info["file_count"])
					fmt.Printf("  Forms: %d\n", info["form_count"])
					fmt.Printf("  Renderers: %d\n", info["renderer_count"])
					fmt.Println()
				}
			}

			// Upload bundle
			color.Cyan("Uploading bundle...")
			c := client.NewClient()
			response, err := c.UploadAppBundle(bundlePath)
			if err != nil {
				cmd.SilenceUsage = true
				// Try to parse error message for better output
				return fmt.Errorf("failed to upload app bundle: %w", err)
			}

			color.Green("✓ App bundle uploaded successfully!")

			// Extract version from response
			version, ok := response["version"].(string)
			if !ok {
				// Try to get from manifest
				if manifest, ok := response["manifest"].(map[string]interface{}); ok {
					version, _ = manifest["version"].(string)
				}
			}

			if version != "" {
				fmt.Printf("Version: %s\n", version)
			}

			// Show manifest if verbose
			if verbose {
				if manifest, ok := response["manifest"].(map[string]interface{}); ok {
					fmt.Println()
					color.Cyan("Manifest:")
					if v, ok := manifest["version"].(string); ok {
						fmt.Printf("  Version: %s\n", v)
					}
					if h, ok := manifest["hash"].(string); ok {
						fmt.Printf("  Hash: %s\n", h)
					}
					if files, ok := manifest["files"].([]interface{}); ok {
						fmt.Printf("  Files: %d\n", len(files))
						if len(files) > 0 && len(files) <= 10 {
							fmt.Println("  File list:")
							for _, file := range files {
								if fileMap, ok := file.(map[string]interface{}); ok {
									path, _ := fileMap["path"].(string)
									size, _ := fileMap["size"].(float64)
									fmt.Printf("    - %s (%d bytes)\n", path, int(size))
								}
							}
						}
					}
				}
			}

			// Auto-activate if requested
			if activate && version != "" {
				fmt.Println()
				color.Cyan("Activating version %s...", version)
				switchResponse, err := c.SwitchAppBundleVersion(version)
				if err != nil {
					color.Yellow("⚠ Warning: Failed to activate version automatically: %v", err)
					color.Yellow("   You can activate it manually with: synk app-bundle switch %s", version)
				} else {
					color.Green("✓ Version %s activated successfully!", version)
				}
				if verbose && switchResponse != nil {
					if msg, ok := switchResponse["message"].(string); ok {
						fmt.Printf("  %s\n", msg)
					}
				}
			} else if version != "" {
				fmt.Println()
				color.Cyan("Tip: Activate this version with:")
				fmt.Printf("  synk app-bundle switch %s\n", version)
			}

			return nil
		},
	}
	uploadCmd.Flags().Bool("skip-validation", false, "Skip bundle validation before upload (not recommended)")
	uploadCmd.Flags().BoolP("activate", "a", false, "Automatically activate the uploaded version")
	uploadCmd.Flags().BoolP("verbose", "v", false, "Show detailed information about the bundle and manifest")
	appBundleCmd.AddCommand(uploadCmd)

	// Changes command
	changesCmd := &cobra.Command{
		Use:   "changes",
		Short: "Show changes between app bundle versions",
		Long: `Compare two versions of the app bundle and display the changes.

If no versions are specified, shows changes between the current version and the previous one.
If only one version is specified, compares it with the current version.`,
		Args: cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			c := client.NewClient()

			// Parse version arguments
			var currentVersion, targetVersion string
			switch len(args) {
			case 0:
				// No arguments - compare current with previous
			case 1:
				// One argument - compare specified version with current
				targetVersion = args[0]
			case 2:
				// Two arguments - compare first with second
				currentVersion = args[0]
				targetVersion = args[1]
			}

			// Get changes from API
			changes, err := c.GetAppBundleChanges(currentVersion, targetVersion)
			if err != nil {
				cmd.SilenceUsage = true
				return fmt.Errorf("failed to get app bundle changes: %w", err)
			}

			// Format output as JSON if requested
			jsonOutput, _ := cmd.Flags().GetBool("json")
			if jsonOutput {
				jsonData, err := json.MarshalIndent(changes, "", "  ")
				if err != nil {
					cmd.SilenceUsage = true
					return fmt.Errorf("error formatting JSON: %w", err)
				}
				fmt.Println(string(jsonData))
				return nil
			}

			// Display formatted output
			fmt.Printf("Changes from version %s to %s\n\n", changes.CurrentVersion, changes.TargetVersion)

			// Added files
			if len(changes.Added) > 0 {
				fmt.Println("Added files:")
				for _, file := range changes.Added {
					fmt.Printf("  - %s\n", file["path"])
				}
				fmt.Println()
			}

			// Modified files
			if len(changes.Modified) > 0 {
				fmt.Println("Modified files:")
				for _, file := range changes.Modified {
					fmt.Printf("  - %s\n", file["path"])
				}
				fmt.Println()
			}

			// Removed files
			if len(changes.Removed) > 0 {
				fmt.Println("Removed files:")
				for _, file := range changes.Removed {
					fmt.Printf("  - %s\n", file["path"])
				}
				fmt.Println()
			}

			if len(changes.Added) == 0 && len(changes.Modified) == 0 && len(changes.Removed) == 0 {
				fmt.Println("No changes found between the specified versions.")
			}

			return nil
		},
	}
	changesCmd.Flags().BoolP("json", "j", false, "Output in JSON format")
	appBundleCmd.AddCommand(changesCmd)

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
				cmd.SilenceUsage = true
				return fmt.Errorf("failed to switch app bundle version: %w", err)
			}

			fmt.Println("App bundle version switched successfully!")
			fmt.Printf("Message: %s\n", response["message"])

			return nil
		},
	}
	appBundleCmd.AddCommand(switchCmd)
}
