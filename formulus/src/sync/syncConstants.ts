/**
 * Tag appended on the client when a pulled server version was not applied because
 * the local row had newer edits (updated_at after last sync). Matches the
 * "last write wins" strategy in WatermelonDBRepo.applyServerChanges.
 */
export const LAST_WRITE_WON_TAG = 'last_write_won';

/**
 * Axios timeout for Synkronus JSON calls (pull, push, login, manifest).
 * Health probes use a separate 10s AbortController. The server no longer
 * applies a 15s absolute WriteTimeout to these routes.
 */
export const SYNC_HTTP_TIMEOUT_MS = 10 * 60 * 1000;
