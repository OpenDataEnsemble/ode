package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/HelloSapiens/collectivus/synkronus-cli/pkg/client"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

func init() {
	// Sync command group
	syncCmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync data with the server",
		Long:  `Commands for synchronizing data with the Synkronus API.`,
	}
	rootCmd.AddCommand(syncCmd)

	// Pull command
	pullCmd := &cobra.Command{
		Use:   "pull [output_file]",
		Short: "Pull data from the server",
		Long: `Pull updated records from the Synkronus API server and save the response to a file.

Examples:
  synk sync pull output.json --client-id my-client
  synk sync pull data.json --client-id my-client --current-version 123 --limit 100`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			outputFile := args[0]

			clientID, err := cmd.Flags().GetString("client-id")
			if err != nil {
				return err
			}

			if clientID == "" {
				return fmt.Errorf("client-id is required")
			}

			currentVersion, err := cmd.Flags().GetInt64("current-version")
			if err != nil {
				return err
			}

			schemaTypesStr, err := cmd.Flags().GetStringSlice("schema-types")
			if err != nil {
				return err
			}

			limit, err := cmd.Flags().GetInt("limit")
			if err != nil {
				return err
			}

			pageToken, err := cmd.Flags().GetString("page-token")
			if err != nil {
				return err
			}

			fmt.Printf("Pulling data from Synkronus API...\n")
			fmt.Printf("Client ID: %s\n", clientID)
			if currentVersion > 0 {
				fmt.Printf("Current Version: %d\n", currentVersion)
			}
			if len(schemaTypesStr) > 0 {
				fmt.Printf("Schema Types: %s\n", strings.Join(schemaTypesStr, ", "))
			}
			if limit > 0 {
				fmt.Printf("Limit: %d\n", limit)
			}
			if pageToken != "" {
				fmt.Printf("Page Token: %s\n", pageToken)
			}

			c := client.NewClient()
			response, err := c.SyncPull(clientID, currentVersion, schemaTypesStr, limit, pageToken)
			if err != nil {
				return fmt.Errorf("sync pull failed: %w", err)
			}

			// Save response to file
			jsonData, err := json.MarshalIndent(response, "", "  ")
			if err != nil {
				return fmt.Errorf("error formatting JSON: %w", err)
			}

			if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
				return fmt.Errorf("error writing to file: %w", err)
			}

			fmt.Printf("\nSync pull completed successfully!\n")
			fmt.Printf("Response saved to: %s\n", outputFile)

			// Display summary information
			if currentVersionResp, ok := response["current_version"]; ok {
				fmt.Printf("Current Version: %v\n", currentVersionResp)
			}
			if records, ok := response["records"].([]interface{}); ok {
				fmt.Printf("Records Retrieved: %d\n", len(records))
			}
			if hasMore, ok := response["has_more"].(bool); ok && hasMore {
				if nextPageToken, ok := response["next_page_token"].(string); ok {
					fmt.Printf("More data available. Use --page-token=%s for next page\n", nextPageToken)
				}
			}

			return nil
		},
	}
	pullCmd.Flags().String("client-id", "", "Client ID for synchronization (required)")
	pullCmd.Flags().Int64("current-version", 0, "Current version number for incremental sync")
	pullCmd.Flags().StringSlice("schema-types", []string{}, "Comma-separated list of schema types to filter")
	pullCmd.Flags().Int("limit", 0, "Maximum number of records to return")
	pullCmd.Flags().String("page-token", "", "Pagination token from previous response")
	pullCmd.MarkFlagRequired("client-id")
	syncCmd.AddCommand(pullCmd)

	// Push command
	pushCmd := &cobra.Command{
		Use:   "push [file]",
		Short: "Push data to the server",
		Long:  `Push new or updated records to the Synkronus API server.`,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			inputFile := args[0]

			// Check if file exists
			if _, err := os.Stat(inputFile); os.IsNotExist(err) {
				return fmt.Errorf("file not found: %s", inputFile)
			}

			// Read input file
			data, err := os.ReadFile(inputFile)
			if err != nil {
				return fmt.Errorf("error reading file: %w", err)
			}

			// Parse input JSON
			var input map[string]interface{}
			if err := json.Unmarshal(data, &input); err != nil {
				return fmt.Errorf("error parsing JSON: %w", err)
			}

			// Extract records
			recordsRaw, ok := input["records"]
			if !ok {
				return fmt.Errorf("input file must contain a 'records' array")
			}

			records, ok := recordsRaw.([]interface{})
			if !ok {
				return fmt.Errorf("'records' must be an array")
			}

			// Convert records to proper format
			recordsFormatted := make([]map[string]interface{}, 0, len(records))
			for _, record := range records {
				recordMap, ok := record.(map[string]interface{})
				if !ok {
					return fmt.Errorf("each record must be an object")
				}
				recordsFormatted = append(recordsFormatted, recordMap)
			}

			// Get client ID
			clientID, err := cmd.Flags().GetString("client-id")
			if err != nil {
				return err
			}

			if clientID == "" {
				// Try to get from input file
				if clientIDRaw, ok := input["client_id"]; ok {
					if clientIDStr, ok := clientIDRaw.(string); ok {
						clientID = clientIDStr
					}
				}

				if clientID == "" {
					return fmt.Errorf("client-id is required")
				}
			}

			// Generate transmission ID if not provided
			transmissionID, err := cmd.Flags().GetString("transmission-id")
			if err != nil {
				return err
			}

			if transmissionID == "" {
				transmissionID = uuid.New().String()
			}

			c := client.NewClient()
			response, err := c.SyncPush(clientID, transmissionID, recordsFormatted)
			if err != nil {
				return fmt.Errorf("sync push failed: %w", err)
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
			fmt.Println("Sync Push Results:")
			fmt.Printf("Server Data Version: %v\n", response["current_version"])
			fmt.Printf("Success Count: %v\n", response["success_count"])

			if failedRecords, ok := response["failed_records"].([]interface{}); ok && len(failedRecords) > 0 {
				fmt.Printf("Failed Records: %d\n", len(failedRecords))
				for _, record := range failedRecords {
					recordMap, ok := record.(map[string]interface{})
					if ok {
						fmt.Printf("  - ID: %s, Error: %s\n",
							recordMap["id"],
							recordMap["error"])
					}
				}
			}

			if warnings, ok := response["warnings"].([]interface{}); ok && len(warnings) > 0 {
				fmt.Printf("Warnings: %d\n", len(warnings))
				for _, warning := range warnings {
					warningMap, ok := warning.(map[string]interface{})
					if ok {
						fmt.Printf("  - ID: %s, Code: %s, Message: %s\n",
							warningMap["id"],
							warningMap["code"],
							warningMap["message"])
					}
				}
			}

			return nil
		},
	}
	pushCmd.Flags().String("client-id", "", "Client ID for synchronization")
	pushCmd.Flags().String("transmission-id", "", "Unique ID for this transmission (for idempotency)")
	pushCmd.Flags().BoolP("json", "j", false, "Output in JSON format")
	syncCmd.AddCommand(pushCmd)
}
