package cmd

import (
	"fmt"
	"path/filepath"

	"github.com/HelloSapiens/collectivus/synkronus-cli/pkg/client"
	"github.com/spf13/cobra"
)

// attachmentsCmd represents the attachments command group
var attachmentsCmd = &cobra.Command{
	Use:   "attachments",
	Short: "Manage file attachments",
	Long:  `Commands for uploading, downloading, and checking attachments.`,
}

// uploadCmd represents the upload command
var uploadCmd = &cobra.Command{
	Use:   "upload <file> --id <attachment_id>",
	Short: "Upload a file as an attachment",
	Long: `Upload a file to the server with the specified attachment ID.
The file will be available at /attachments/<attachment_id>`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := args[0]
		attachmentID, _ := cmd.Flags().GetString("id")

		if attachmentID == "" {
			// If no ID provided, use the filename
			attachmentID = filepath.Base(filePath)
		}

		c := client.NewClient()
		_, err := c.UploadAttachment(attachmentID, filePath)
		if err != nil {
			return fmt.Errorf("upload failed: %w", err)
		}

		fmt.Printf("Successfully uploaded %s as attachment %s\n", filePath, attachmentID)
		return nil
	},
}

// downloadCmd represents the download command
var downloadCmd = &cobra.Command{
	Use:   "download <attachment_id> [output_file]",
	Short: "Download an attachment",
	Long: `Download an attachment from the server.
If output_file is not specified, the original filename will be used.`,
	Args: cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		attachmentID := args[0]
		outputFile := ""

		if len(args) > 1 {
			outputFile = args[1]
		} else {
			// Use the attachment ID as the filename if not specified
			outputFile = attachmentID
		}

		c := client.NewClient()
		err := c.DownloadAttachment(attachmentID, outputFile)
		if err != nil {
			return fmt.Errorf("download failed: %w", err)
		}

		fmt.Printf("Successfully downloaded attachment %s to %s\n", attachmentID, outputFile)
		return nil
	},
}

// existsCmd represents the exists command
var existsCmd = &cobra.Command{
	Use:   "exists <attachment_id>",
	Short: "Check if an attachment exists",
	Long:  `Check if an attachment with the given ID exists on the server.`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		attachmentID := args[0]

		c := client.NewClient()
		exists, err := c.AttachmentExists(attachmentID)
		if err != nil {
			return fmt.Errorf("failed to check attachment: %w", err)
		}

		if exists {
			fmt.Printf("Attachment %s exists\n", attachmentID)
		} else {
			fmt.Printf("Attachment %s does not exist\n", attachmentID)
		}
		return nil
	},
}

func init() {
	// Add commands to the attachments command group
	attachmentsCmd.AddCommand(uploadCmd)
	attachmentsCmd.AddCommand(downloadCmd)
	attachmentsCmd.AddCommand(existsCmd)

	// Add flags
	uploadCmd.Flags().String("id", "", "Attachment ID (defaults to filename if not provided)")

	// Add attachments command to root
	rootCmd.AddCommand(attachmentsCmd)
}
