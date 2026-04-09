package sync

import (
	"context"
	"fmt"
)

// HardResetRepository deletes observation and attachment sync state, resets the observation stream
// cursor, increments repository_generation, and records who performed the reset.
func (s *Service) HardResetRepository(ctx context.Context, adminUsername string) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if _, err := tx.ExecContext(ctx, `DELETE FROM observations`); err != nil {
		return 0, fmt.Errorf("delete observations: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM attachment_operations`); err != nil {
		return 0, fmt.Errorf("delete attachment_operations: %w", err)
	}

	var newGen int64
	err = tx.QueryRowContext(ctx, `
		UPDATE sync_version SET
			current_version = 1,
			repository_generation = repository_generation + 1,
			last_reset_at = NOW(),
			last_reset_by = $1,
			updated_at = NOW()
		WHERE id = 1
		RETURNING repository_generation`, adminUsername).Scan(&newGen)
	if err != nil {
		return 0, fmt.Errorf("update sync_version after reset: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	committed = true

	s.log.Info("Hard repository reset completed",
		"repositoryGeneration", newGen,
		"adminUsername", adminUsername)

	return newGen, nil
}
