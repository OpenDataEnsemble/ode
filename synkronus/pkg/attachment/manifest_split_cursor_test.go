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

// TestManifest_OnlyLatestOperationPerAttachment guards the DISTINCT ON query
// contract used by the manifest service: if an attachment goes through
// multiple operations (create -> update -> delete), a client syncing from
// `since_version=0` must see ONLY the latest operation for each attachment_id,
// never older intermediate rows.
func TestManifest_OnlyLatestOperationPerAttachment(t *testing.T) {
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
	size := 1024
	ct := "image/jpeg"

	attachmentA := "00000000-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg"
	attachmentB := "00000000-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg"

	// A: create, then update.
	require.NoError(t, svc.RecordOperation(ctx, attachmentA, "create", "", &size, &ct))
	require.NoError(t, svc.RecordOperation(ctx, attachmentA, "update", "", &size, &ct))
	// B: create, then delete.
	require.NoError(t, svc.RecordOperation(ctx, attachmentB, "create", "", &size, &ct))
	require.NoError(t, svc.RecordOperation(ctx, attachmentB, "delete", "", nil, nil))

	manifest, err := svc.GetManifest(ctx, attachment.AttachmentManifestRequest{
		ClientID:     "device-a",
		SinceVersion: 0,
	})
	require.NoError(t, err)

	// We expect exactly two rows — the latest per id.
	require.Len(t, manifest.Operations, 2)
	seen := map[string]string{}
	for _, op := range manifest.Operations {
		seen[op.AttachmentID] = op.Operation
	}
	// create/update both normalize to `download` in the manifest.
	assert.Equal(t, "download", seen[attachmentA])
	assert.Equal(t, "delete", seen[attachmentB])
}

// TestManifest_SplitCursor_NeverMissesOps verifies the Formulus split-cursor
// contract: `@last_attachment_version` is tracked separately from the
// observation cursor, so even when observation and attachment versions are
// interleaved on the single `sync_version.current_version`, querying the
// manifest with a cursor behind the latest op must still yield that op.
//
// Regression guard: a client that advances only its observation cursor and
// leaves `@last_attachment_version=0` should see every attachment op that
// ever happened.
func TestManifest_SplitCursor_NeverMissesOps(t *testing.T) {
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
	size := 1024
	ct := "image/jpeg"

	ids := []string{
		"00000000-1111-1111-1111-111111111111.jpg",
		"00000000-2222-2222-2222-222222222222.jpg",
		"00000000-3333-3333-3333-333333333333.jpg",
	}
	for _, id := range ids {
		require.NoError(t, svc.RecordOperation(ctx, id, "create", "", &size, &ct))
	}

	// First pull: cursor at 0 must see all three.
	m1, err := svc.GetManifest(ctx, attachment.AttachmentManifestRequest{
		ClientID:     "split-cursor-device",
		SinceVersion: 0,
	})
	require.NoError(t, err)
	require.Len(t, m1.Operations, 3)

	// Advance the shared `sync_version.current_version` by recording more ops
	// (simulating additional observation commits that also bump the counter).
	for _, id := range ids {
		require.NoError(t, svc.RecordOperation(ctx, id, "update", "", &size, &ct))
	}

	// Client keeps its attachment cursor at the value it had after m1 — it
	// must still receive the latest ops for each id, never a stale row.
	m2, err := svc.GetManifest(ctx, attachment.AttachmentManifestRequest{
		ClientID:     "split-cursor-device",
		SinceVersion: m1.CurrentVersion,
	})
	require.NoError(t, err)
	require.Len(t, m2.Operations, 3, "split cursor should still receive latest ops per id")
	for _, op := range m2.Operations {
		assert.Equal(t, "download", op.Operation, "updates normalize to download")
		assert.Greater(t, op.Version, m1.CurrentVersion, "op version must advance past previous cursor")
	}
}

// TestHardReset_WipesAttachmentOps verifies that HardResetRepository deletes
// every row in `attachment_operations`, not just observations. The attachment
// manifest served to a post-reset client must be empty at version 1.
func TestHardReset_WipesAttachmentOps(t *testing.T) {
	if testing.Short() {
		t.Skip("requires PostgreSQL")
	}

	db, cleanup := synctest.SetupTestDatabase(t)
	defer cleanup()

	log := logger.NewLogger()
	cfg := &config.Config{Port: "8099"}
	manifestSvc := attachment.NewManifestService(db, cfg, log)
	require.NoError(t, manifestSvc.Initialize(context.Background()))

	ctx := context.Background()
	size := 1024
	ct := "image/jpeg"
	attachmentID := "00000000-9999-9999-9999-999999999999.jpg"
	require.NoError(t, manifestSvc.RecordOperation(ctx, attachmentID, "create", "", &size, &ct))

	// Sanity: the row exists before reset.
	pre, err := manifestSvc.GetManifest(ctx, attachment.AttachmentManifestRequest{
		ClientID:     "device",
		SinceVersion: 0,
	})
	require.NoError(t, err)
	require.Len(t, pre.Operations, 1)

	// Perform hard reset.
	syncSvc := synctest.NewService(db, synctest.DefaultConfig(), log)
	require.NoError(t, syncSvc.Initialize(ctx))
	newGen, err := syncSvc.HardResetRepository(ctx, "admin-test")
	require.NoError(t, err)
	assert.Greater(t, newGen, int64(1))

	// Post-reset manifest: no operations, generation advanced.
	post, err := manifestSvc.GetManifest(ctx, attachment.AttachmentManifestRequest{
		ClientID:     "device",
		SinceVersion: 0,
	})
	require.NoError(t, err)
	assert.Empty(t, post.Operations, "attachment_operations should be wiped by hard reset")
	assert.Equal(t, newGen, post.RepositoryGeneration)
}
