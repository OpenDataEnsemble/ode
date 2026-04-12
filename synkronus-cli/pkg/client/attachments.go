package client

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client/generated"
)

// UploadAttachment uploads a file to the server with the specified attachment ID
func (c *Client) UploadAttachment(attachmentID string, filePath string) (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}

	// Open the file
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("error opening file: %w", err)
	}
	defer file.Close()

	// Create a buffer to store the request body
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Create a form file field
	part, err := writer.CreateFormFile("file", filePath)
	if err != nil {
		return nil, fmt.Errorf("error creating form file: %w", err)
	}

	// Copy file content to the form
	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("error copying file content: %w", err)
	}

	// Close the writer to finalize the form
	if err := writer.Close(); err != nil {
		return nil, err
	}

	resp, err := c.api.UploadAttachmentWithBodyWithResponse(
		context.Background(),
		attachmentID,
		&generated.UploadAttachmentParams{},
		writer.FormDataContentType(),
		body,
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.StatusCode() != 200 {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}

	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// DownloadAttachment downloads an attachment from the server
func (c *Client) DownloadAttachment(attachmentID string, outputPath string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}

	resp, err := c.api.DownloadAttachmentWithResponse(context.Background(), attachmentID, nil)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	if resp.StatusCode() != 200 {
		return apiError(resp.StatusCode(), resp.Body)
	}

	// Create output file
	out, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("error creating output file: %w", err)
	}
	defer out.Close()

	// Copy response body to file
	_, err = io.Copy(out, bytes.NewReader(resp.Body))
	if err != nil {
		return fmt.Errorf("error saving file: %w", err)
	}

	return nil
}

// AttachmentExists checks if an attachment exists on the server
func (c *Client) AttachmentExists(attachmentID string) (bool, error) {
	if err := c.ensureReady(); err != nil {
		return false, err
	}

	resp, err := c.api.CheckAttachmentExistsWithResponse(context.Background(), attachmentID, nil)
	if err != nil {
		return false, fmt.Errorf("request failed: %w", err)
	}

	switch resp.StatusCode() {
	case 200:
		return true, nil
	case 404:
		return false, nil
	default:
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}
}
