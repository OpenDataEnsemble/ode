package cmd

import (
	"fmt"
	"syscall"
	"time"

	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/auth"
	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/utils"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func init() {
	// Login command
	loginCmd := &cobra.Command{
		Use:   "login",
		Short: "Login to the Synkronus API",
		Long:  `Authenticate with the Synkronus API using your username and password.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			username, err := cmd.Flags().GetString("username")
			if err != nil {
				return err
			}

			if username == "" {
				fmt.Print("Username: ")
				fmt.Scanln(&username)
			}

			fmt.Print("Password: ")
			passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
			if err != nil {
				return fmt.Errorf("error reading password: %w", err)
			}
			fmt.Println() // Add newline after password input

			password := string(passwordBytes)
			tokenResp, err := auth.Login(username, password)
			if err != nil {
				return fmt.Errorf("login failed: %w", err)
			}

			utils.PrintSuccess("Login successful!")
			// Extract token type from JWT (Bearer)
			tokenType := "Bearer"
			// Calculate expiry time in seconds
			expirySeconds := tokenResp.ExpiresAt - time.Now().Unix()
			fmt.Printf("%s\n", utils.FormatKeyValue("Token type", tokenType))
			fmt.Printf("%s\n", utils.FormatKeyValue("Expires in", fmt.Sprintf("%d seconds", expirySeconds)))
			return nil
		},
	}

	loginCmd.Flags().StringP("username", "u", "", "Username for authentication")
	rootCmd.AddCommand(loginCmd)

	// Logout command
	logoutCmd := &cobra.Command{
		Use:   "logout",
		Short: "Logout from the Synkronus API",
		Long:  `Clear authentication tokens for the Synkronus API.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := auth.Logout(); err != nil {
				return fmt.Errorf("logout failed: %w", err)
			}
			utils.PrintSuccess("Logout successful!")
			return nil
		},
	}
	rootCmd.AddCommand(logoutCmd)

	// Status command
	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show authentication status",
		Long:  `Display information about the current authentication status.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			claims, err := auth.GetUserInfo()
			if err != nil {
				return fmt.Errorf("not authenticated: %w", err)
			}

			utils.PrintHeading("Authentication Status")
			fmt.Printf("%s\n", utils.FormatKeyValue("Username", claims.Username))
			fmt.Printf("%s\n", utils.FormatKeyValue("Role", claims.Role))
			fmt.Printf("%s\n", utils.FormatKeyValue("Expires at", claims.RegisteredClaims.ExpiresAt.Time))
			return nil
		},
	}
	rootCmd.AddCommand(statusCmd)
}
