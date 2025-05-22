package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/HelloSapiens/collectivus/synkronus-cli/internal/auth"
	"github.com/spf13/viper"
)

// AppBundleChanges represents the changes between two app bundle versions
type AppBundleChanges struct {
	CurrentVersion string                   `json:"current_version"`
	TargetVersion  string                   `json:"target_version"`
	Added         []map[string]interface{} `json:"added"`
	Modified      []map[string]interface{} `json:"modified"`
	Removed       []map[string]interface{} `json:"removed"`
}

// Client represents a Synkronus API client
type Client struct {
	BaseURL    string
	APIVersion string
	HTTPClient *http.Client
}

// NewClient creates a new Synkronus API client
func NewClient() *Client {
	return &Client{
		BaseURL:    viper.GetString("api.url"),
		APIVersion: viper.GetString("api.version"),
		HTTPClient: &http.Client{
			Timeout: time.Second * 30,
		},
	}
}

// doRequest performs an HTTP request with authentication
func (c *Client) doRequest(req *http.Request) (*http.Response, error) {
	// Add API version header
	req.Header.Set("x-api-version", c.APIVersion)

	// Get authentication token
	token, err := auth.GetToken()
	if err != nil {
		return nil, fmt.Errorf("authentication error: %w", err)
	}

	// Add authorization header
	req.Header.Set("Authorization", "Bearer "+token)

	// Perform request
	return c.HTTPClient.Do(req)
}

// GetAppBundleManifest retrieves the app bundle manifest
func (c *Client) GetAppBundleManifest() (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/app-bundle/manifest", c.BaseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return result, nil
}

// GetAppBundleVersions retrieves available app bundle versions
func (c *Client) GetAppBundleVersions() (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/app-bundle/versions", c.BaseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return result, nil
}

// GetAppBundleChanges gets the changes between two app bundle versions
func (c *Client) GetAppBundleChanges(currentVersion, targetVersion string) (*AppBundleChanges, error) {
	url := fmt.Sprintf("%s/app-bundle/changes", c.BaseURL)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Add query parameters if provided
	q := req.URL.Query()
	if currentVersion != "" {
		q.Add("current", currentVersion)
	}
	if targetVersion != "" {
		q.Add("target", targetVersion)
	}
	req.URL.RawQuery = q.Encode()

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var changes AppBundleChanges
	if err := json.NewDecoder(resp.Body).Decode(&changes); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return &changes, nil
}

// DownloadAppBundleFile downloads a specific file from the app bundle
// If preview is true, adds ?preview=true to the request URL
func (c *Client) DownloadAppBundleFile(path, destPath string, preview bool) error {
	url := fmt.Sprintf("%s/app-bundle/download/%s", c.BaseURL, url.PathEscape(path))
if preview {
	url += "?preview=true"
}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Create destination directory if it doesn't exist
	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	// Create destination file
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	// Copy response body to file
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return err
	}

	return nil
}

// UploadAppBundle uploads a new app bundle
func (c *Client) UploadAppBundle(bundlePath string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/app-bundle/push", c.BaseURL)

	// Open the bundle file
	file, err := os.Open(bundlePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file to form
	part, err := writer.CreateFormFile("bundle", filepath.Base(bundlePath))
	if err != nil {
		return nil, err
	}

	// Copy file content to form
	_, err = io.Copy(part, file)
	if err != nil {
		return nil, err
	}

	// Close multipart writer
	err = writer.Close()
	if err != nil {
		return nil, err
	}

	// Create request
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}

	// Set content type
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// SwitchAppBundleVersion switches to a specific app bundle version
func (c *Client) SwitchAppBundleVersion(version string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/app-bundle/switch/%s", c.BaseURL, version)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return result, nil
}

// SyncPull pulls updated records from the server
func (c *Client) SyncPull(clientID string, afterChangeID int, schemaTypes []string, limit int, pageToken string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/sync/pull", c.BaseURL)

	// Add query parameters
	if limit > 0 {
		url = fmt.Sprintf("%s?limit=%d", url, limit)
	}

	if pageToken != "" {
		url = fmt.Sprintf("%s&page_token=%s", url, pageToken)
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"client_id": clientID,
	}

	if afterChangeID > 0 {
		reqBody["after_change_id"] = afterChangeID
	}

	if len(schemaTypes) > 0 {
		reqBody["schema_types"] = schemaTypes
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return result, nil
}

// SyncPush pushes records to the server
func (c *Client) SyncPush(clientID string, transmissionID string, records []map[string]interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/sync/push", c.BaseURL)

	// Prepare request body
	reqBody := map[string]interface{}{
		"client_id":       clientID,
		"transmission_id": transmissionID,
		"records":         records,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error parsing response: %w", err)
	}

	return result, nil
}
