package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAppBundleManifest(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// Create a test request
	req := httptest.NewRequest(http.MethodGet, "/app-bundle/manifest", nil)
	w := httptest.NewRecorder()

	// Call the handler
	h.GetAppBundleManifest(w, req)

	// Check response
	resp := w.Result()
	defer resp.Body.Close()

	// Check status code
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected status code %d, got %d", http.StatusOK, resp.StatusCode)

	// Check content type
	contentType := resp.Header.Get("content-type")
	assert.Equal(t, "application/json", contentType, "Expected content type application/json, got %s", contentType)

	// Check ETag header
	etag := resp.Header.Get("etag")
	assert.NotEmpty(t, etag, "Expected ETag header to be set")

	// Check response body structure
	var manifest struct {
		Files       []interface{} `json:"files"`
		Version     string        `json:"version"`
		GeneratedAt string        `json:"generatedAt"`
		Hash        string        `json:"hash"`
	}
	err := json.NewDecoder(resp.Body).Decode(&manifest)
	require.NoError(t, err, "Failed to decode response body")

	// Verify response fields
	assert.NotEmpty(t, manifest.Files, "Expected files array to be non-empty")
	assert.NotEmpty(t, manifest.Version, "Expected version to be non-empty")
	assert.NotEmpty(t, manifest.GeneratedAt, "Expected generatedAt to be non-empty")
	assert.NotEmpty(t, manifest.Hash, "Expected hash to be non-empty")
}

func TestGetAppBundleFile(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// Create a router for URL parameter extraction
	r := chi.NewRouter()
	r.Get("/app-bundle/{path}", h.GetAppBundleFile)

	// Test cases
	testCases := []struct {
		name           string
		path           string
		expectedStatus int
		expectedType   string
	}{
		{
			name:           "Valid HTML file",
			path:           "index.html",
			expectedStatus: http.StatusOK,
			expectedType:   "text/html",
		},
		{
			name:           "Valid CSS file",
			path:           "styles.css",
			expectedStatus: http.StatusOK,
			expectedType:   "text/css",
		},
		{
			name:           "Valid JS file",
			path:           "app.js",
			expectedStatus: http.StatusOK,
			expectedType:   "application/javascript",
		},
		{
			name:           "Non-existent file",
			path:           "nonexistent.txt",
			expectedStatus: http.StatusNotFound,
			expectedType:   "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a test request
			req := httptest.NewRequest(http.MethodGet, "/app-bundle/"+tc.path, nil)
			w := httptest.NewRecorder()

			// Serve the request through the router to extract URL parameters
			r.ServeHTTP(w, req)

			// Check response
			resp := w.Result()
			defer resp.Body.Close()

			// Check status code
			assert.Equal(t, tc.expectedStatus, resp.StatusCode, "Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)

			// For successful requests, check additional properties
			if tc.expectedStatus == http.StatusOK {
				// Check content type
				contentType := resp.Header.Get("content-type")
				assert.Equal(t, tc.expectedType, contentType, "Expected content type %s, got %s", tc.expectedType, contentType)

				// Check ETag header
				etag := resp.Header.Get("etag")
				assert.NotEmpty(t, etag, "Expected ETag header to be set")

				// Check that response body is not empty
				body, err := resp.Body.Read(make([]byte, 1))
				assert.True(t, body > 0 || err == nil, "Expected response body to not be empty")
			}
		})
	}
}

func TestGetAppBundleFileNotModified(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// First request to get the ETag
	req1 := httptest.NewRequest(http.MethodGet, "/app-bundle/index.html", nil)
	w1 := httptest.NewRecorder()

	// Create a router for URL parameter extraction
	r := chi.NewRouter()
	r.Get("/app-bundle/{path}", h.GetAppBundleFile)

	// Serve the first request
	r.ServeHTTP(w1, req1)
	resp1 := w1.Result()
	defer resp1.Body.Close()

	// Get the ETag from the first response
	etag := resp1.Header.Get("etag")
	require.NotEmpty(t, etag, "Expected ETag header to be set")

	// Second request with If-None-Match header
	req2 := httptest.NewRequest(http.MethodGet, "/app-bundle/index.html", nil)
	req2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()

	// Serve the second request
	r.ServeHTTP(w2, req2)
	resp2 := w2.Result()
	defer resp2.Body.Close()

	// Check that the second response has a 304 Not Modified status
	assert.Equal(t, http.StatusNotModified, resp2.StatusCode, "Expected status code %d, got %d", http.StatusNotModified, resp2.StatusCode)
}

func TestGetAppBundleManifestNotModified(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// First request to get the ETag
	req1 := httptest.NewRequest(http.MethodGet, "/app-bundle/manifest", nil)
	w1 := httptest.NewRecorder()

	// Call the handler
	h.GetAppBundleManifest(w1, req1)
	resp1 := w1.Result()
	defer resp1.Body.Close()

	// Get the ETag from the first response
	etag := resp1.Header.Get("etag")
	require.NotEmpty(t, etag, "Expected ETag header to be set")

	// Second request with If-None-Match header
	req2 := httptest.NewRequest(http.MethodGet, "/app-bundle/manifest", nil)
	req2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()

	// Call the handler again
	h.GetAppBundleManifest(w2, req2)
	resp2 := w2.Result()
	defer resp2.Body.Close()

	// Check that the second response has a 304 Not Modified status
	assert.Equal(t, http.StatusNotModified, resp2.StatusCode, "Expected status code %d, got %d", http.StatusNotModified, resp2.StatusCode)
}
