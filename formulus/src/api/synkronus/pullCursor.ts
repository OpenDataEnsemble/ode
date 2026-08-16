/**
 * Decides how the observation pull loop proceeds after a page has been applied
 * to the local database.
 *
 * The pull cursor (`@last_seen_version`) is persisted **per page** rather than
 * once at the end of the whole pull. That is what makes an interrupted pull
 * resumable: without it, losing the connection on the last page of a large
 * repository throws away every page before it and the next attempt starts from
 * zero again, which on a field connection can mean sync never completes at all.
 *
 * Persisting `change_cutoff` cannot skip records. It is the same watermark the
 * loop already uses to request the next page, so a resumed run asks the server
 * exactly what this run would have asked for next, and `applyServerChanges`
 * upserts — re-applying a page that was already applied changes nothing.
 */

export type PullPageOutcome =
  /** More pages follow. Request the next one from `nextSince` and persist it. */
  | { kind: 'continue'; nextSince: number }
  /** Final page. Persist `version` as the observation stream cursor. */
  | { kind: 'done'; version: number }
  /**
   * The response cannot be used to make progress. Continuing would re-request
   * the same page forever, so the caller must fail loudly instead of looping.
   */
  | { kind: 'unusable'; reason: string };

export interface PullPageCursorFields {
  current_version?: number | null;
  change_cutoff?: number | null;
  has_more?: boolean;
}

function asVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function pullPageOutcome(
  page: PullPageCursorFields,
  since: number,
): PullPageOutcome {
  if (!page.has_more) {
    const version = asVersion(page.current_version);
    if (version == null) {
      return {
        kind: 'unusable',
        reason: `final page reported current_version=${JSON.stringify(
          page.current_version,
        )}, which is not a usable version number`,
      };
    }
    return { kind: 'done', version };
  }

  const cutoff = asVersion(page.change_cutoff);
  if (cutoff == null) {
    return {
      kind: 'unusable',
      reason: `server reported more pages but change_cutoff=${JSON.stringify(
        page.change_cutoff,
      )}, which is not a usable version number`,
    };
  }
  if (cutoff <= since) {
    return {
      kind: 'unusable',
      reason: `server reported more pages but change_cutoff (${cutoff}) does not advance past since (${since})`,
    };
  }

  return { kind: 'continue', nextSince: cutoff };
}
