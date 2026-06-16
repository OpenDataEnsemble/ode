import { normalizeBasename, referencedNamesForObservation } from './importValidation';
import { tauriClient } from './tauriClient';
import type {
  BundleFormSpec,
  ObservationRecord,
  WorkspaceAttachmentPresenceEntry,
} from '../types/domain';

export type MissingAttachmentIssue = {
  id: string;
  formType: string;
  missing: string[];
};

function refsMissingAfterPresence(
  refs: string[],
  presenceRows: WorkspaceAttachmentPresenceEntry[],
): string[] {
  const normPresent = new Set<string>();
  for (const row of presenceRows) {
    if (row.present) {
      normPresent.add(normalizeBasename(row.fileName));
    }
  }
  return refs.filter(r => !normPresent.has(normalizeBasename(r)));
}

async function attachmentRefsForPushObservation(
  o: ObservationRecord,
  specCache: Map<string, BundleFormSpec | undefined>,
): Promise<string[]> {
  const ft = o.formType?.trim();
  let spec: BundleFormSpec | undefined;
  if (ft) {
    if (!specCache.has(ft)) {
      try {
        const s = await tauriClient.readBundleFormSpec(ft);
        specCache.set(ft, s);
      } catch {
        specCache.set(ft, undefined);
      }
    }
    spec = specCache.get(ft);
  }
  return [...referencedNamesForObservation(spec?.formSchema, o.payload)];
}

export async function partitionPendingPushObservations(
  pending: ObservationRecord[],
  forceMissing: boolean,
): Promise<{
  readyToPush: ObservationRecord[];
  missingAttachmentIssues: MissingAttachmentIssue[];
}> {
  const specCache = new Map<string, BundleFormSpec | undefined>();
  const missingAttachmentIssues: MissingAttachmentIssue[] = [];
  const readyToPush: ObservationRecord[] = [];

  for (const o of pending) {
    const refs = [...new Set(await attachmentRefsForPushObservation(o, specCache))];
    const formType = (o.formType ?? '').trim() || '(unknown)';
    if (refs.length === 0) {
      readyToPush.push(o);
      continue;
    }
    const presenceRows = await tauriClient.checkWorkspaceAttachmentPresence(refs);
    const missing = refsMissingAfterPresence(refs, presenceRows);
    if (missing.length === 0) {
      readyToPush.push(o);
    } else {
      missingAttachmentIssues.push({ id: o.id, formType, missing });
      if (forceMissing) {
        readyToPush.push(o);
      }
    }
  }

  return { readyToPush, missingAttachmentIssues };
}

/** Scan dirty observations for attachment files missing on disk before push. */
export async function auditPendingPushMissingAttachments(
  pending: ObservationRecord[],
): Promise<MissingAttachmentIssue[]> {
  const { missingAttachmentIssues } = await partitionPendingPushObservations(
    pending,
    false,
  );
  return missingAttachmentIssues;
}

export function formatMissingAttachmentSummary(
  issues: MissingAttachmentIssue[],
): string {
  return issues
    .map(
      s =>
        `${s.id} (${s.formType}): ${s.missing.map(n => `"${n}"`).join(', ')}`,
    )
    .join('\n');
}
