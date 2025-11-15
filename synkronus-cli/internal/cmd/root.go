package cmd

import (
	"os"
	"path/filepath"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/config"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string
	rootCmd = &cobra.Command{
		Use:   "synk",
		Short: "Synkronus CLI - A command-line interface for the Synkronus API",
		Long: `Synkronus CLI is a command-line tool for interacting with the Synkronus API.
It provides functionality for authentication, sync operations, app bundle management, and more.`,
	}
)

// completionCmd represents the completion command
var completionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate shell completion script",
	Long: `To load completions for your current shell session, run:

$ source <(synk completion zsh)  # for zsh
$ source <(synk completion bash)  # for bash
$ synk completion fish | source  # for fish

To load completions for every new session, execute once:

# Linux:
$ synk completion bash > /etc/bash_completion.d/synk

# macOS:
$ synk completion bash > /usr/local/etc/bash_completion.d/synk

# PowerShell:
PS> synk completion powershell | Out-String | Invoke-Expression

# PowerShell (permanent):
PS> synk completion powershell > synk.ps1
# Add this line to your PowerShell profile
`,
	DisableFlagsInUseLine: true,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
	RunE: func(cmd *cobra.Command, args []string) error {
		switch args[0] {
		case "bash":
			return cmd.Root().GenBashCompletion(os.Stdout)
		case "zsh":
			return cmd.Root().GenZshCompletion(os.Stdout)
		case "fish":
			return cmd.Root().GenFishCompletion(os.Stdout, true)
		case "powershell":
			return cmd.Root().GenPowerShellCompletionWithDesc(os.Stdout)
		}
		return nil
	},
}

// Execute executes the root command.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.synkronus.yaml)")
	rootCmd.PersistentFlags().String("api-url", "http://localhost:8080", "Synkronus API URL")
	rootCmd.PersistentFlags().String("api-version", "1.0.0", "API version to use")

	viper.BindPFlag("api.url", rootCmd.PersistentFlags().Lookup("api-url"))
	viper.BindPFlag("api.version", rootCmd.PersistentFlags().Lookup("api-version"))

	// Add completion command
	rootCmd.AddCommand(completionCmd)

	// Apply colored help template
	utils.SetupColoredHelp(rootCmd)
}

func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory
		home, err := os.UserHomeDir()
		cobra.CheckErr(err)

		// Search config in home directory with name ".synkronus" (without extension)
		viper.AddConfigPath(home)
		viper.SetConfigType("yaml")
		viper.SetConfigName(".synkronus")

		// Also look for config in the current directory
		viper.AddConfigPath(".")
	}

	// Read in environment variables that match
	viper.AutomaticEnv()

	// If a config file is found, read it in
	if err := viper.ReadInConfig(); err == nil {
		//fmt.Printf("# Using config file: %s\n", viper.ConfigFileUsed())
	} else {
		// Create default config if it doesn't exist
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			defaultConfig := config.DefaultConfig()
			configDir := filepath.Dir(filepath.Join(os.Getenv("HOME"), ".synkronus.yaml"))
			if _, err := os.Stat(configDir); os.IsNotExist(err) {
				os.MkdirAll(configDir, 0755)
			}
			viper.SetConfigFile(filepath.Join(os.Getenv("HOME"), ".synkronus.yaml"))
			for k, v := range defaultConfig {
				viper.Set(k, v)
			}
			viper.WriteConfig()
		}
	}
}
