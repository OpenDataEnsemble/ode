package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/config"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

func init() {
	// Config command group
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "Manage CLI configuration",
		Long:  `Commands for managing Synkronus CLI configuration.`,
	}
	rootCmd.AddCommand(configCmd)

	// Init config command
	initCmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize configuration file",
		Long:  `Create a default configuration file if it doesn't exist.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			configPath, err := cmd.Flags().GetString("output")
			if err != nil {
				return err
			}

			if configPath == "" {
				home, err := os.UserHomeDir()
				if err != nil {
					return fmt.Errorf("error getting home directory: %w", err)
				}
				configPath = filepath.Join(home, ".synkronus.yaml")
			}

			// Check if config file already exists
			if _, err := os.Stat(configPath); err == nil {
				overwrite, err := cmd.Flags().GetBool("force")
				if err != nil {
					return err
				}
				if !overwrite {
					return fmt.Errorf("config file already exists at %s (use --force to overwrite)", configPath)
				}
			}

			// Create config directory if it doesn't exist
			configDir := filepath.Dir(configPath)
			if _, err := os.Stat(configDir); os.IsNotExist(err) {
				if err := os.MkdirAll(configDir, 0755); err != nil {
					return fmt.Errorf("error creating config directory: %w", err)
				}
			}

			// Generate default config
			defaultConfig := config.DefaultConfig()

			// Convert to YAML
			yamlData, err := yaml.Marshal(defaultConfig)
			if err != nil {
				return fmt.Errorf("error generating YAML: %w", err)
			}

			// Write to file
			if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
				return fmt.Errorf("error writing config file: %w", err)
			}

			fmt.Printf("Configuration file created at %s\n", configPath)
			return nil
		},
	}
	initCmd.Flags().StringP("output", "o", "", "Output path for config file (default: $HOME/.synkronus.yaml)")
	initCmd.Flags().BoolP("force", "f", false, "Overwrite existing config file")
	configCmd.AddCommand(initCmd)

	// View config command
	viewCmd := &cobra.Command{
		Use:   "view",
		Short: "View current configuration",
		Long:  `Display the current configuration settings.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get all settings
			allSettings := viper.AllSettings()

			// Convert to YAML
			yamlData, err := yaml.Marshal(allSettings)
			if err != nil {
				return fmt.Errorf("error formatting config: %w", err)
			}

			fmt.Printf("Current Configuration:\n%s\n", string(yamlData))
			fmt.Printf("Config file: %s\n", viper.ConfigFileUsed())
			return nil
		},
	}
	configCmd.AddCommand(viewCmd)

	// Set config command
	setCmd := &cobra.Command{
		Use:   "set [key] [value]",
		Short: "Set configuration value",
		Long:  `Set a configuration value and save it to the config file.`,
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]

			viper.Set(key, value)
			if err := viper.WriteConfig(); err != nil {
				return fmt.Errorf("error writing config: %w", err)
			}

			fmt.Printf("Set %s = %s\n", key, value)
			return nil
		},
	}
	configCmd.AddCommand(setCmd)
}
