import {
  normalizeBasename,
  referencedNamesForObservation,
} from './importValidation';
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
    const refs = [
      ...new Set(await attachmentRefsForPushObservation(o, specCache)),
    ];
    const formType = (o.formType ?? '').trim() || '(unknown)';
    if (refs.length === 0) {
      readyToPush.push(o);
      continue;
    }
    const presenceRows =
      await tauriClient.checkWorkspaceAttachmentPresence(refs);
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

/** One-line UI highlight (no per-observation dump). */
export function formatMissingAttachmentHighlight(
  issues: MissingAttachmentIssue[],
  mode: 'skipped' | 'forced',
): string {
  if (issues.length === 0) {
    return '';
  }
  const n = issues.length;
  const noun = n === 1 ? 'observation' : 'observations';
  if (mode === 'forced') {
    return ` Included ${n} ${noun} with missing attachment(s) (forced).`;
  }
  return ` Skipped ${n} ${noun} with missing attachment file(s).`;
}

/** Full multi-line report suitable for saving to a text file. */
export function formatMissingAttachmentReport(
  issues: MissingAttachmentIssue[],
  mode: 'skipped' | 'forced',
  meta?: { headline?: string },
): string {
  const lines: string[] = [];
  lines.push('ODE Desktop — push attachment report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(
    `Mode: ${mode === 'forced' ? 'forced inclusion' : 'skipped from push'}`,
  );
  if (meta?.headline?.trim()) {
    lines.push('');
    lines.push(meta.headline.trim());
  }
  lines.push('');
  lines.push(
    `Summary: ${issues.length} observation(s) with missing attachment file(s).`,
  );
  lines.push('');
  lines.push('Details:');
  for (const issue of issues) {
    lines.push(`${issue.id} (form: ${issue.formType})`);
    for (const name of issue.missing) {
      lines.push(`  - ${name}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
