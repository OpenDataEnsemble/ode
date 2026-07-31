package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/logger"
	authmw "github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/sync"
)

// TestAttachmentUpload_FollowedByManifest_ReturnsDownloadForSecondDevice exercises the
// contract the mobile app relies on: PUT /attachments/{id} must register a manifest row
// so POST /attachments/manifest returns a download for other clients.
func TestAttachmentUpload_FollowedByManifest_ReturnsDownloadForSecondDevice(t *testing.T) {
	if testing.Short() {
		t.Skip("requires PostgreSQL")
	}

	db, cleanup := sync.SetupTestDatabase(t)
	defer cleanup()

	dataDir := t.TempDir()
	cfg := &config.Config{
		Port:    "8098",
		DataDir: dataDir,
	}
	log := logger.NewLogger()

	attSvc, err := attachment.NewService(cfg)
	require.NoError(t, err)
	manifestSvc := attachment.NewManifestService(db, cfg, log)
	require.NoError(t, manifestSvc.Initialize(context.Background()))

	syncSvc := sync.NewService(db, sync.DefaultConfig(), log)
	require.NoError(t, syncSvc.Initialize(context.Background()))

	attHandler := NewAttachmentHandler(log, attSvc, manifestSvc, syncSvc)

	h := NewHandler(
		log,
		cfg,
		&mockAuthService{},
		&mockAppBundleService{},
		syncSvc,
		&mockUserService{},
		&mockVersionService{},
		manifestSvc,
		mocks.NewMockDataExportService(),
		mocks.NewMockStatsService(),
		nil,
	)

	r := chi.NewRouter()
	r.Route("/api", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(authmw.AuthMiddleware(&mockAuthService{}, log))
			r.Route("/attachments", func(r chi.Router) {
				r.Post("/manifest", h.AttachmentManifestHandler)
				r.Route("/{attachment_id}", func(r chi.Router) {
					r.Put("/", attHandler.UploadAttachment)
				})
			})
		})
	})

	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)

	attachmentID := "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"
	uploadURL := ts.URL + "/api/attachments/" + attachmentID

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("file", "photo.jpg")
	require.NoError(t, err)
	_, err = part.Write([]byte("fake jpeg bytes"))
	require.NoError(t, err)
	require.NoError(t, mw.Close())

	req, err := http.NewRequest(http.MethodPut, uploadURL, &buf)
	require.NoError(t, err)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	ubody, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("upload status %d: %s", resp.StatusCode, string(ubody))
	}

	manifestBody, err := json.Marshal(attachment.AttachmentManifestRequest{
		ClientID:     "second-device",
		SinceVersion: 0,
	})
	require.NoError(t, err)

	mreq, err := http.NewRequest(http.MethodPost, ts.URL+"/api/attachments/manifest", bytes.NewReader(manifestBody))
	require.NoError(t, err)
	mreq.Header.Set("Content-Type", "application/json")
	mreq.Header.Set("Authorization", "Bearer test-token")

	mresp, err := http.DefaultClient.Do(mreq)
	require.NoError(t, err)
	defer mresp.Body.Close()
	mbody, err := io.ReadAll(mresp.Body)
	require.NoError(t, err)
	if mresp.StatusCode != http.StatusOK {
		t.Fatalf("manifest status %d: %s", mresp.StatusCode, string(mbody))
	}

	var m attachment.AttachmentManifestResponse
	require.NoError(t, json.Unmarshal(mbody, &m))
	require.Len(t, m.Operations, 1)
	op := m.Operations[0]
	assert.Equal(t, "download", op.Operation)
	assert.Equal(t, attachmentID, op.AttachmentID)
	require.NotNil(t, op.DownloadURL)
}
