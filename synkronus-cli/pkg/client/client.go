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
	"strings"
	"time"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/auth"
	"github.com/spf13/viper"
)

// AppBundleChanges represents the changes between two app bundle versions
type AppBundleChanges struct {
	CurrentVersion string           `json:"current_version"`
	TargetVersion  string           `json:"target_version"`
	Added          []map[string]any `json:"added"`
	Modified       []map[string]any `json:"modified"`
	Removed        []map[string]any `json:"removed"`
}

// SystemVersionInfo represents the version information of the Synkronus server
type SystemVersionInfo struct {
	Server   ServerInfo   `json:"server"`
	Database DatabaseInfo `json:"database"`
	System   SystemInfo   `json:"system"`
	Build    BuildInfo    `json:"build"`
}

type ServerInfo struct {
	Version string `json:"version"`
}

type DatabaseInfo struct {
	Type         string `json:"type"`
	Version      string `json:"version"`
	DatabaseName string `json:"database_name"`
}

type SystemInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	CPUs         int    `json:"cpus"`
}

type BuildInfo struct {
	Commit    string `json:"commit"`
	BuildTime string `json:"build_time"`
	GoVersion string `json:"go_version"`
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
// GetVersion retrieves version information from the Synkronus server
func (c *Client) GetVersion() (*SystemVersionInfo, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/version", c.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating version request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("version request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("version check failed: %s", errResp.Error)
	}

	var versionInfo SystemVersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&versionInfo); err != nil {
		return nil, fmt.Errorf("error parsing version response: %w", err)
	}

	return &versionInfo, nil
}

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
func (c *Client) SyncPull(clientID string, currentVersion int64, schemaTypes []string, limit int, pageToken string) (map[string]interface{}, error) {
	requestURL := fmt.Sprintf("%s/sync/pull", c.BaseURL)

	// Build query parameters
	var queryParams []string
	if limit > 0 {
		queryParams = append(queryParams, fmt.Sprintf("limit=%d", limit))
	}
	if pageToken != "" {
		queryParams = append(queryParams, fmt.Sprintf("page_token=%s", url.QueryEscape(pageToken)))
	}
	if len(schemaTypes) == 1 {
		// Single schemaType can be passed as query parameter
		queryParams = append(queryParams, fmt.Sprintf("schemaType=%s", url.QueryEscape(schemaTypes[0])))
	}

	if len(queryParams) > 0 {
		requestURL = fmt.Sprintf("%s?%s", requestURL, strings.Join(queryParams, "&"))
	}

	// Prepare request body according to SyncPullRequest schema
	reqBody := map[string]interface{}{
		"client_id": clientID,
	}

	// Add 'since' object if currentVersion is provided
	if currentVersion > 0 {
		reqBody["since"] = map[string]interface{}{
			"version": currentVersion,
		}
	}

	// Add schema_types array if multiple types are specified
	if len(schemaTypes) > 1 {
		reqBody["schema_types"] = schemaTypes
	} else if len(schemaTypes) == 1 && pageToken == "" {
		// If not added as query param, add to body
		reqBody["schema_types"] = schemaTypes
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", requestURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Add API version header
	if c.APIVersion != "" {
		req.Header.Set("x-api-version", c.APIVersion)
	}

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
