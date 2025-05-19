package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/HelloSapiens/collectivus/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

// userCmd represents the user command group
var userCmd = &cobra.Command{
	Use:   "user",
	Short: "Manage Synkronus users (admin only for most operations)",
}

// listUsersCmd represents the 'user list' command
var listUsersCmd = &cobra.Command{
	Use:   "list",
	Short: "List all users (admin only)",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewClient()
		users, err := c.ListUsers()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing users: %v\n", err)
			os.Exit(1)
		}
		if len(users) == 0 {
			fmt.Println("No users found.")
			return
		}
		fmt.Printf("%-24s %-12s\n", "USERNAME", "ROLE")
		fmt.Println(strings.Repeat("-", 36))
		for _, u := range users {
			uname, _ := u["username"].(string)
			role, _ := u["role"].(string)
			fmt.Printf("%-24s %-12s\n", uname, role)
		}
	},
}

// createUserCmd represents the 'user create' command
var createUserCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new user (admin only)",
	Run: func(cmd *cobra.Command, args []string) {
		username, _ := cmd.Flags().GetString("username")
		password, _ := cmd.Flags().GetString("password")
		role, _ := cmd.Flags().GetString("role")
		c := client.NewClient()
		resp, err := c.CreateUser(client.UserCreateRequest{
			Username: username,
			Password: password,
			Role:     role,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating user: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("User '%s' created successfully.\n", resp["username"])
	},
}

// deleteUserCmd represents the 'user delete' command
var deleteUserCmd = &cobra.Command{
	Use:   "delete [username]",
	Short: "Delete a user by username (admin only)",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		username := args[0]
		c := client.NewClient()
		err := c.DeleteUser(username)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting user: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("User '%s' deleted successfully.\n", username)
	},
}

// resetPasswordCmd represents the 'user reset-password' command
var resetPasswordCmd = &cobra.Command{
	Use:   "reset-password",
	Short: "Reset a user's password (admin only)",
	Run: func(cmd *cobra.Command, args []string) {
		username, _ := cmd.Flags().GetString("username")
		newPassword, _ := cmd.Flags().GetString("new-password")
		c := client.NewClient()
		err := c.ResetUserPassword(client.UserResetPasswordRequest{
			Username:    username,
			NewPassword: newPassword,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resetting password: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Password reset successfully for user '%s'.\n", username)
	},
}

// changePasswordCmd represents the 'user change-password' command
var changePasswordCmd = &cobra.Command{
	Use:   "change-password",
	Short: "Change your own password",
	Run: func(cmd *cobra.Command, args []string) {
		oldPassword, _ := cmd.Flags().GetString("old-password")
		newPassword, _ := cmd.Flags().GetString("new-password")
		c := client.NewClient()
		err := c.ChangeOwnPassword(client.UserChangePasswordRequest{
			OldPassword: oldPassword,
			NewPassword: newPassword,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error changing password: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Password changed successfully.")
	},
}

func init() {
	// Attach user subcommands
	createUserCmd.Flags().String("username", "", "Username for the new user")
	createUserCmd.Flags().String("password", "", "Password for the new user")
	createUserCmd.Flags().String("role", "read-only", "Role for the new user (read-only, read-write, admin)")
	createUserCmd.MarkFlagRequired("username")
	createUserCmd.MarkFlagRequired("password")
	createUserCmd.MarkFlagRequired("role")

	resetPasswordCmd.Flags().String("username", "", "Username of the user whose password to reset")
	resetPasswordCmd.Flags().String("new-password", "", "New password for the user")
	resetPasswordCmd.MarkFlagRequired("username")
	resetPasswordCmd.MarkFlagRequired("new-password")

	changePasswordCmd.Flags().String("old-password", "", "Current password")
	changePasswordCmd.Flags().String("new-password", "", "New password")
	changePasswordCmd.MarkFlagRequired("old-password")
	changePasswordCmd.MarkFlagRequired("new-password")

	userCmd.AddCommand(listUsersCmd)
	userCmd.AddCommand(createUserCmd)
	userCmd.AddCommand(deleteUserCmd)
	userCmd.AddCommand(resetPasswordCmd)
	userCmd.AddCommand(changePasswordCmd)

	rootCmd.AddCommand(userCmd)
}
