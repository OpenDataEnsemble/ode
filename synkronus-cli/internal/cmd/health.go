package cmd

import (
	"fmt"
	"net/http"
	"time"

	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/utils"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	healthCmd := &cobra.Command{
		Use:   "health",
		Short: "Check the health of the Synkronus API",
		Long:  `Verify connectivity to the Synkronus API server.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			apiURL := viper.GetString("api.url")
			
			utils.PrintInfo("Checking API health at %s...", apiURL)
			
			client := &http.Client{
				Timeout: 10 * time.Second,
			}
			
			start := time.Now()
			resp, err := client.Get(apiURL)
			if err != nil {
				return fmt.Errorf("connection failed: %w", err)
			}
			defer resp.Body.Close()
			
			duration := time.Since(start)
			
			// Print status with appropriate color based on status code
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				utils.PrintSuccess("API responded with status: %s", resp.Status)
			} else if resp.StatusCode >= 400 && resp.StatusCode < 500 {
				utils.PrintWarning("API responded with status: %s", resp.Status)
			} else if resp.StatusCode >= 500 {
				utils.PrintError("API responded with status: %s", resp.Status)
			} else {
				fmt.Printf("%s\n", utils.FormatKeyValue("API status", resp.Status))
			}
			
			// Format response time with color based on duration
			respTimeStr := duration.String()
			if duration < 100*time.Millisecond {
				respTimeStr = utils.Success(respTimeStr)
			} else if duration < 500*time.Millisecond {
				respTimeStr = utils.Info(respTimeStr)
			} else if duration < 1*time.Second {
				respTimeStr = utils.Warning(respTimeStr)
			} else {
				respTimeStr = utils.Error(respTimeStr)
			}
			
			fmt.Printf("%s\n", utils.FormatKeyValue("Response time", respTimeStr))
			
			// Check if API version header is supported
			apiVersion := viper.GetString("api.version")
			fmt.Printf("%s\n", utils.FormatKeyValue("Using API version", apiVersion))
			
			return nil
		},
	}
	rootCmd.AddCommand(healthCmd)
}
