import { describe, expect, it } from 'vitest';
import {
  formatMissingAttachmentHighlight,
  formatMissingAttachmentReport,
  type MissingAttachmentIssue,
} from './pushAttachmentAudit';

const sample: MissingAttachmentIssue[] = [
  {
    id: 'obs_1',
    formType: 'p_consent',
    missing: ['a.jpg', 'a'],
  },
  {
    id: 'obs_2',
    formType: 'p_consent',
    missing: ['b.jpg'],
  },
];

describe('formatMissingAttachmentHighlight', () => {
  it('stays short for forced and skipped modes', () => {
    const forced = formatMissingAttachmentHighlight(sample, 'forced');
    const skipped = formatMissingAttachmentHighlight(sample, 'skipped');
    expect(forced).toContain('Included 2 observations');
    expect(forced).toContain('(forced)');
    expect(forced).not.toContain('obs_1');
    expect(skipped).toContain('Skipped 2 observations');
    expect(skipped).not.toContain('a.jpg');
    expect(forced.length).toBeLessThan(120);
    expect(skipped.length).toBeLessThan(120);
  });
});

describe('formatMissingAttachmentReport', () => {
  it('includes full per-observation detail for download', () => {
    const report = formatMissingAttachmentReport(sample, 'forced');
    expect(report).toContain('forced inclusion');
    expect(report).toContain('obs_1 (form: p_consent)');
    expect(report).toContain('- a.jpg');
    expect(report).toContain('obs_2 (form: p_consent)');
  });
});
