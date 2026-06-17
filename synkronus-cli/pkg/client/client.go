package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/auth"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client/generated"
	"github.com/spf13/viper"
)

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
	api        *generated.ClientWithResponses
	initErr    error
}

// NewClient creates a new Synkronus API client
func NewClient() *Client {
	baseURL := utils.OriginURL(viper.GetString("api.url"))
	apiVersion := viper.GetString("api.version")
	httpClient := &http.Client{
		Timeout: time.Second * 30,
	}

	reqEditor := func(ctx context.Context, req *http.Request) error {
		token, err := auth.GetToken()
		if err != nil {
			return fmt.Errorf("authentication error: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		return nil
	}

	api, err := generated.NewClientWithResponses(
		baseURL,
		generated.WithHTTPClient(httpClient),
		generated.WithRequestEditorFn(reqEditor),
	)

	return &Client{
		BaseURL:    baseURL,
		APIVersion: apiVersion,
		api:        api,
		initErr:    err,
	}
}

func (c *Client) ensureReady() error {
	if c.initErr != nil {
		return fmt.Errorf("client initialization failed: %w", c.initErr)
	}
	return nil
}

func (c *Client) requiredVersion() (string, error) {
	if c.APIVersion == "" {
		return "", fmt.Errorf("api.version is required")
	}
	return c.APIVersion, nil
}

func toMap(v any) (map[string]interface{}, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func toMapSlice[T any](v []T) ([]map[string]interface{}, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out []map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func apiError(status int, body []byte) error {
	msg := strings.TrimSpace(string(body))
	if msg == "" {
		return fmt.Errorf("API error (status %d)", status)
	}
	return fmt.Errorf("API error (status %d): %s", status, msg)
}

// GetVersion retrieves version information from the Synkronus server
func (c *Client) GetVersion() (*SystemVersionInfo, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	apiVer, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}

	resp, err := c.api.GetVersionWithResponse(
		context.Background(),
		&generated.GetVersionParams{XOdeVersion: apiVer},
	)
	if err != nil {
		return nil, fmt.Errorf("version request failed: %w", err)
	}

	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	out := &SystemVersionInfo{}
	if resp.JSON200.Server != nil && resp.JSON200.Server.Version != nil {
		out.Server.Version = *resp.JSON200.Server.Version
	}
	if resp.JSON200.Database != nil {
		if resp.JSON200.Database.Type != nil {
			out.Database.Type = *resp.JSON200.Database.Type
		}
		if resp.JSON200.Database.Version != nil {
			out.Database.Version = *resp.JSON200.Database.Version
		}
		if resp.JSON200.Database.DatabaseName != nil {
			out.Database.DatabaseName = *resp.JSON200.Database.DatabaseName
		}
	}
	if resp.JSON200.System != nil {
		if resp.JSON200.System.Os != nil {
			out.System.OS = *resp.JSON200.System.Os
		}
		if resp.JSON200.System.Architecture != nil {
			out.System.Architecture = *resp.JSON200.System.Architecture
		}
		if resp.JSON200.System.Cpus != nil {
			out.System.CPUs = *resp.JSON200.System.Cpus
		}
	}
	if resp.JSON200.Build != nil {
		if resp.JSON200.Build.Commit != nil {
			out.Build.Commit = *resp.JSON200.Build.Commit
		}
		if resp.JSON200.Build.BuildTime != nil {
			out.Build.BuildTime = *resp.JSON200.Build.BuildTime
		}
		if resp.JSON200.Build.GoVersion != nil {
			out.Build.GoVersion = *resp.JSON200.Build.GoVersion
		}
	}
	return out, nil
}

// GetAppBundleManifest retrieves the app bundle manifest
func (c *Client) GetAppBundleManifest() (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}
	resp, err := c.api.GetAppBundleManifestWithResponse(
		context.Background(),
		&generated.GetAppBundleManifestParams{XOdeVersion: version},
	)
	if err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// GetAppBundleVersions retrieves available app bundle versions
func (c *Client) GetAppBundleVersions() (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}
	resp, err := c.api.GetAppBundleVersionsWithResponse(
		context.Background(),
		&generated.GetAppBundleVersionsParams{XOdeVersion: version},
	)
	if err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// DownloadAppBundleFile downloads a specific file from the app bundle
// If preview is true, adds ?preview=true to the request URL
func (c *Client) DownloadAppBundleFile(path, destPath string, preview bool) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return err
	}
	params := &generated.DownloadAppBundleFileParams{XOdeVersion: version}
	if preview {
		params.Preview = &preview
	}
	resp, err := c.api.DownloadAppBundleFileWithResponse(
		context.Background(),
		path,
		params,
	)
	if err != nil {
		return err
	}
	if resp.StatusCode() != 200 {
		return apiError(resp.StatusCode(), resp.Body)
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
	_, err = io.Copy(out, bytes.NewReader(resp.Body))
	if err != nil {
		return err
	}

	return nil
}

// downloadBinaryToFile performs an authenticated GET on path (must start with /, e.g. /dataexport/parquet)
// and streams the body to destPath. Uses no overall HTTP timeout so large ZIP exports can complete.
func (c *Client) downloadBinaryToFile(path string, destPath string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	apiVer, err := c.requiredVersion()
	if err != nil {
		return err
	}

	var body []byte
	var status int

	switch path {
	case "/dataexport/parquet":
		var resp *generated.GetParquetExportZipHTTPResponse
		resp, err = c.api.GetParquetExportZipWithResponse(
			context.Background(),
			&generated.GetParquetExportZipParams{XOdeVersion: apiVer},
		)
		if err == nil {
			body = resp.Body
			status = resp.StatusCode()
		}
	case "/dataexport/raw-json":
		var resp *generated.GetRawJsonExportZipHTTPResponse
		resp, err = c.api.GetRawJsonExportZipWithResponse(
			context.Background(),
			&generated.GetRawJsonExportZipParams{XOdeVersion: apiVer},
		)
		if err == nil {
			body = resp.Body
			status = resp.StatusCode()
		}
	case "/attachments/export-zip":
		var resp *generated.GetAttachmentsExportZipHTTPResponse
		resp, err = c.api.GetAttachmentsExportZipWithResponse(
			context.Background(),
			&generated.GetAttachmentsExportZipParams{XOdeVersion: apiVer},
		)
		if err == nil {
			body = resp.Body
			status = resp.StatusCode()
		}
	default:
		return fmt.Errorf("unsupported binary export path: %s", path)
	}

	if err != nil {
		return err
	}

	if status != 200 {
		msg := strings.TrimSpace(string(body))
		if status == 503 && msg == "" {
			return fmt.Errorf("API error (status %d): service unavailable", status)
		}
		return fmt.Errorf("API error (status %d): %s", status, msg)
	}

	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, bytes.NewReader(body))
	return err
}

// DownloadParquetExport downloads the Parquet export ZIP archive to the specified destination path
func (c *Client) DownloadParquetExport(destPath string) error {
	return c.downloadBinaryToFile("/dataexport/parquet", destPath)
}

// DownloadRawJSONExport downloads the per-observation JSON ZIP export to the specified destination path
func (c *Client) DownloadRawJSONExport(destPath string) error {
	return c.downloadBinaryToFile("/dataexport/raw-json", destPath)
}

// DownloadAttachmentsExport downloads a ZIP of all current attachments to the specified destination path
func (c *Client) DownloadAttachmentsExport(destPath string) error {
	return c.downloadBinaryToFile("/attachments/export-zip", destPath)
}

// UploadAppBundle uploads a new app bundle
func (c *Client) UploadAppBundle(bundlePath string) (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}

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

	resp, err := c.api.PushAppBundleWithBodyWithResponse(
		context.Background(),
		&generated.PushAppBundleParams{XOdeVersion: version},
		writer.FormDataContentType(),
		body,
	)
	if err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// SwitchAppBundleVersion switches to a specific app bundle version
func (c *Client) SwitchAppBundleVersion(version string) (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	apiVersion, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}
	resp, err := c.api.SwitchAppBundleVersionWithResponse(
		context.Background(),
		version,
		&generated.SwitchAppBundleVersionParams{XOdeVersion: apiVersion},
	)
	if err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// AdminRepositoryReset performs an irreversible server-side wipe of observation and attachment sync data (admin JWT).
func (c *Client) AdminRepositoryReset() (*generated.RepositoryResetResponse, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	apiVer, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}
	resp, err := c.api.AdminRepositoryResetWithResponse(
		context.Background(),
		&generated.AdminRepositoryResetParams{XOdeVersion: apiVer},
		generated.RepositoryResetRequest{Confirm: generated.RESETREPOSITORY},
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.JSON200 != nil {
		return resp.JSON200, nil
	}
	return nil, apiError(resp.StatusCode(), resp.Body)
}

// SyncPull pulls updated records from the server
func (c *Client) SyncPull(clientID string, currentVersion int64, schemaTypes []string, limit int, pageToken string, repositoryGeneration *int64) (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}

	// Prepare request body according to SyncPullRequest schema
	reqBody := map[string]interface{}{
		"client_id": clientID,
	}
	if repositoryGeneration != nil {
		reqBody["repository_generation"] = *repositoryGeneration
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

	params := &generated.SyncPullParams{XOdeVersion: version}
	if repositoryGeneration != nil {
		params.XRepositoryGeneration = repositoryGeneration
	}
	if limit > 0 {
		params.Limit = &limit
	}
	if len(schemaTypes) == 1 {
		params.SchemaType = &schemaTypes[0]
	}

	editors := []generated.RequestEditorFn{}
	if pageToken != "" {
		token := pageToken
		editors = append(editors, func(ctx context.Context, req *http.Request) error {
			q := req.URL.Query()
			q.Set("page_token", token)
			req.URL.RawQuery = q.Encode()
			return nil
		})
	}

	resp, err := c.api.SyncPullWithBodyWithResponse(
		context.Background(),
		params,
		"application/json",
		bytes.NewReader(jsonData),
		editors...,
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}

// SyncPush pushes records to the server
func (c *Client) SyncPush(clientID string, transmissionID string, records []map[string]interface{}, repositoryGeneration *int64) (map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"client_id":       clientID,
		"transmission_id": transmissionID,
		"records":         records,
	}
	if repositoryGeneration != nil {
		reqBody["repository_generation"] = *repositoryGeneration
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	pushParams := &generated.SyncPushParams{XOdeVersion: version}
	if repositoryGeneration != nil {
		pushParams.XRepositoryGeneration = repositoryGeneration
	}

	resp, err := c.api.SyncPushWithBodyWithResponse(
		context.Background(),
		pushParams,
		"application/json",
		bytes.NewReader(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON200)
}
