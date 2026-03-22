package attachment_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/logger"
	synctest "github.com/opendataensemble/synkronus/pkg/sync"
)

// TestManifest_RecordOperation_ReachesOtherClients verifies that attachment manifest
// rows with NULL client_id are returned to any client. A missing RecordOperation on
// upload used to mean other devices never saw download ops — this test guards the DB contract.
func TestManifest_RecordOperation_ReachesOtherClients(t *testing.T) {
	if testing.Short() {
		t.Skip("requires PostgreSQL")
	}

	db, cleanup := synctest.SetupTestDatabase(t)
	defer cleanup()

	log := logger.NewLogger()
	cfg := &config.Config{Port: "8099"}
	svc := attachment.NewManifestService(db, cfg, log)
	require.NoError(t, svc.Initialize(context.Background()))

	ctx := context.Background()
	attachmentID := "00000000-1111-2222-3333-444444444444.jpg"
	size := 2048
	ct := "image/jpeg"

	require.NoError(t, svc.RecordOperation(ctx, attachmentID, "create", "", &size, &ct))

	for _, clientID := range []string{"device-a", "device-b"} {
		manifest, err := svc.GetManifest(ctx, attachment.AttachmentManifestRequest{
			ClientID:     clientID,
			SinceVersion: 0,
		})
		require.NoError(t, err, "client_id=%q", clientID)
		require.Len(t, manifest.Operations, 1, "client_id=%q", clientID)
		op := manifest.Operations[0]
		assert.Equal(t, "download", op.Operation)
		assert.Equal(t, attachmentID, op.AttachmentID)
		assert.NotNil(t, op.DownloadURL)
		assert.Equal(t, size, *op.Size)
		require.NotNil(t, op.ContentType)
		assert.Equal(t, ct, *op.ContentType)
	}
}
