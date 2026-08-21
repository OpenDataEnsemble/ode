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
});
