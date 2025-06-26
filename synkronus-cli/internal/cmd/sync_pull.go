package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/utils"
	"github.com/HelloSapiens/collectivus/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	syncPullCmd := &cobra.Command{
		Use:   "sync_pull [output_file]",
		Short: "Pull updated records from the Synkronus server",
		Long: `Pull updated records from the Synkronus server and save the JSON response to a file.
		
Example:
  synk sync_pull output.json
  synk sync_pull data.json --client-id my-client --current-version 123 --limit 100`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			outputFile := args[0]
			
			// Get configuration values
			apiURL := viper.GetString("api.url")
			apiVersion := viper.GetString("api.version")
			
			// Get command flags
			clientID, _ := cmd.Flags().GetString("client-id")
			currentVersionStr, _ := cmd.Flags().GetString("current-version")
			schemaTypesStr, _ := cmd.Flags().GetString("schema-types")
			limit, _ := cmd.Flags().GetInt("limit")
			pageToken, _ := cmd.Flags().GetString("page-token")
			
			// Validate required parameters
			if clientID == "" {
				return fmt.Errorf("client-id is required")
			}
			
			// Parse current version
			var currentVersion int64
			if currentVersionStr != "" {
				var err error
				currentVersion, err = strconv.ParseInt(currentVersionStr, 10, 64)
				if err != nil {
					return fmt.Errorf("invalid current-version: %w", err)
				}
			}
			
			// Parse schema types
			var schemaTypes []string
			if schemaTypesStr != "" {
				schemaTypes = strings.Split(schemaTypesStr, ",")
				// Trim whitespace from each type
				for i, schemaType := range schemaTypes {
					schemaTypes[i] = strings.TrimSpace(schemaType)
				}
			}
			
			utils.PrintInfo("Pulling sync data from %s...", apiURL)
			utils.PrintInfo("Client ID: %s", clientID)
			if currentVersion > 0 {
				utils.PrintInfo("Current Version: %d", currentVersion)
			}
			if len(schemaTypes) > 0 {
				utils.PrintInfo("Schema Types: %s", strings.Join(schemaTypes, ", "))
			}
			if limit > 0 {
				utils.PrintInfo("Limit: %d", limit)
			}
			if pageToken != "" {
				utils.PrintInfo("Page Token: %s", pageToken)
			}
			
			// Create client
			c := client.NewClient()
			c.BaseURL = apiURL
			c.APIVersion = apiVersion
			
			// Make sync pull request
			result, err := c.SyncPull(clientID, currentVersion, schemaTypes, limit, pageToken)
			if err != nil {
				return fmt.Errorf("sync pull failed: %w", err)
			}
			
			// Convert result to pretty JSON
			jsonData, err := json.MarshalIndent(result, "", "  ")
			if err != nil {
				return fmt.Errorf("error formatting JSON response: %w", err)
			}
			
			// Write to output file
			err = os.WriteFile(outputFile, jsonData, 0644)
			if err != nil {
				return fmt.Errorf("error writing to file %s: %w", outputFile, err)
			}
			
			utils.PrintSuccess("Sync data saved to %s", outputFile)
			
			// Print summary information from response
			if currentVersionVal, ok := result["current_version"]; ok {
				utils.PrintInfo("Current server version: %v", currentVersionVal)
			}
			if records, ok := result["records"].([]interface{}); ok {
				utils.PrintInfo("Records received: %d", len(records))
			}
			if changeCutoff, ok := result["change_cutoff"]; ok {
				utils.PrintInfo("Change cutoff: %v", changeCutoff)
			}
			if hasMore, ok := result["has_more"].(bool); ok && hasMore {
				if nextPageToken, ok := result["next_page_token"].(string); ok {
					utils.PrintInfo("More data available. Use --page-token=%s for next page", nextPageToken)
				}
			}
			
			return nil
		},
	}
	
	// Add flags
	syncPullCmd.Flags().String("client-id", "", "Client ID for sync operation (required)")
	syncPullCmd.Flags().String("current-version", "", "Current version number to sync from")
	syncPullCmd.Flags().String("schema-types", "", "Comma-separated list of schema types to filter (optional)")
	syncPullCmd.Flags().Int("limit", 50, "Maximum number of records to return (1-500)")
	syncPullCmd.Flags().String("page-token", "", "Pagination token from previous response")
	
	// Mark required flags
	syncPullCmd.MarkFlagRequired("client-id")
	
	rootCmd.AddCommand(syncPullCmd)
}
