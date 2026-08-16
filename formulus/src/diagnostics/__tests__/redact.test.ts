import {
  joinLogArgs,
  pickAllowedExtras,
  redactText,
  WEBVIEW_INFO_MESSAGE_MAX,
} from '../redact';

describe('redact', () => {
  it('strips bearer tokens, emails, file URIs, and cookies', () => {
    const raw =
      'Authorization Bearer abc.def.ghi cookie=secret file:///data/user/0/x/photo.jpg user@example.org';
    const out = redactText(raw);
    expect(out).not.toContain('abc.def.ghi');
    expect(out).not.toContain('user@example.org');
    expect(out).not.toContain('file:///data');
    expect(out).not.toContain('secret');
    expect(out).toContain('[redacted]');
    expect(out).toContain('[email]');
  });

  it('replaces lat/lon pairs and JSON blobs', () => {
    const out = redactText(
      'at 9.012345, 38.765432 payload {"name":"Amina","hh_id":"HH-1","village":"x"}',
    );
    expect(out).toContain('[latlon]');
    expect(out).toContain('[json]');
    expect(out).not.toContain('Amina');
  });

  it('truncates long messages', () => {
    const out = redactText('x'.repeat(800), 500);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(501);
  });

  it('allowlists extras and drops unknown keys', () => {
    expect(
      pickAllowedExtras({
        phase: 'pull_observations',
        counts: 12,
        formType: 'household',
        screen: 'Sync',
        success: true,
        observationId: 'should-drop',
        data: { secret: true },
      }),
    ).toEqual({
      phase: 'pull_observations',
      counts: 12,
      formType: 'household',
      screen: 'Sync',
      success: true,
    });
  });

  it('joins webview args without persisting object dumps', () => {
    const joined = joinLogArgs([
      'saved',
      { p_id: 'P1', name: 'secret' },
      '{"hh_id":"HH-1","name":"Amina","extra":true}',
    ]);
    expect(joined).toBe('saved [json] [json]');
    expect(redactText(joined, WEBVIEW_INFO_MESSAGE_MAX)).not.toContain('Amina');
  });
});
