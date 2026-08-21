/**
 * Tag appended on the client when a pulled server version was not applied because
 * the local row had newer edits (updated_at after last sync). Matches the
 * "last write wins" strategy in WatermelonDBRepo.applyServerChanges.
 */
export const LAST_WRITE_WON_TAG = 'last_write_won';

/**
 * Records requested per `syncPull` page.
 *
 * Synkronus defaults to 50 when `limit` is omitted (OpenAPI max 500; service
 * cap 1000). Typical observation JSON is ~0.5–2 KB, so 500 rows is about
 * 0.25–1 MB per page (two pages in memory while the next HTTP fetch overlaps
 * apply). That halves the round-trips of 250 on a 20k first pull without
 * crossing the documented API max. SQLite is still one writer — pages are
 * applied sequentially.
 */
export const PULL_PAGE_SIZE = 500;

/**
 * Attachment files pulled at once during sync.
 *
 * Each download is native I/O (RNFS) and pays a full HTTP/TLS round trip, so a
 * small pool hides latency on photo-heavy first syncs. Four stays under typical
 * field-WiFi and tablet connection limits; unbounded `Promise.all` does not.
 * Observation apply stays sequential — this pool is downloads only.
 */
export const ATTACHMENT_DOWNLOAD_CONCURRENCY = 4;
