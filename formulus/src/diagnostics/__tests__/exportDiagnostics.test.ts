import {
  buildSummaryText,
  DIAGNOSTICS_ZIP_FILES,
  serverHostnameOnly,
} from '../exportDiagnosticsText';

describe('exportDiagnostics', () => {
  it('includes only the diagnostic zip members', () => {
    expect([...DIAGNOSTICS_ZIP_FILES]).toEqual([
      'events.ndjson',
      'exits.ndjson',
      'summary.txt',
    ]);
    expect(DIAGNOSTICS_ZIP_FILES).not.toEqual(
      expect.arrayContaining(['observations.json', 'attachments']),
    );
  });

  it('keeps only the server hostname', () => {
    expect(serverHostnameOnly('https://sync.example.org/api/v1?token=x')).toBe(
      'sync.example.org',
    );
    expect(serverHostnameOnly(null)).toBe('(none)');
  });

  it('builds a summary without observation payloads', () => {
    const text = buildSummaryText({
      deviceModel: 'Blackview',
      systemName: 'Android',
      systemVersion: '14',
      appVersion: '1.2.3 (45)',
      serverHost: 'sync.example.org',
      lastExitReason: 'Context.startForeground did not start in time',
      breadcrumbs: ['2026-08-16T10:00:00.000Z fgs.start'],
    });
    expect(text).toContain('Blackview');
    expect(text).toContain('fgs.start');
    expect(text).not.toContain('observation');
    expect(text).not.toContain('hh_id');
  });

  it('lists captured trace files under traces/', () => {
    const text = buildSummaryText({
      deviceModel: 'SM-T545',
      systemName: 'Android',
      systemVersion: '11',
      appVersion: '1.2.1 (26)',
      serverHost: 'sync.example.org',
      lastExitReason: 'crash',
      breadcrumbs: ['2026-08-22T15:30:16.033Z session.start'],
      traceFiles: ['jvm-1787412612893.txt', 'aei-1786984183555.txt'],
    });
    expect(text).toContain('captured traces:');
    expect(text).toContain('traces/jvm-1787412612893.txt');
    expect(text).toContain('traces/aei-1786984183555.txt');
  });

  it('shows (none) when no traces were captured', () => {
    const text = buildSummaryText({
      deviceModel: 'SM-T545',
      systemName: 'Android',
      systemVersion: '11',
      appVersion: '1.2.1 (26)',
      serverHost: 'sync.example.org',
      lastExitReason: 'crash',
      breadcrumbs: [],
    });
    expect(text).toContain('captured traces:\n(none)');
  });
});
