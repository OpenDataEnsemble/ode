/**
 * Tag appended on the client when a pulled server version was not applied because
 * the local row had newer edits (updated_at after last sync). Matches the
 * "last write wins" strategy in WatermelonDBRepo.applyServerChanges.
 */
export const LAST_WRITE_WON_TAG = 'last_write_won';
