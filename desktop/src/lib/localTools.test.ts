import {
  buildAgentPrompt,
  cliCommand,
  localToolsHintLines,
} from './localTools';

const profile = { id: 'p1', label: ' Study A ' };

describe('localTools', () => {
  it('quotes CLI paths with spaces and falls back to ode', () => {
    expect(cliCommand(null)).toBe('ode');
    expect(cliCommand('C:\\ODE\\ode.exe')).toBe('C:\\ODE\\ode.exe');
    expect(cliCommand('C:\\Program Files\\ODE\\ode.exe')).toBe(
      '"C:\\Program Files\\ODE\\ode.exe"',
    );
  });

  it('omits hints when local tools are disabled', () => {
    expect(
      localToolsHintLines({ ...profile, localToolsEnabled: false }, null),
    ).toEqual([]);
    expect(localToolsHintLines(null, null)).toEqual([]);
    const lines = localToolsHintLines(profile, '/opt/ode/ode');
    expect(lines).toContain('  /opt/ode/ode forms list --profile p1');
    expect(lines[lines.length - 1]).toContain('Profile: Study A.');
  });

  it('builds a prompt reflecting data access', () => {
    const metaOnly = buildAgentPrompt(profile, null);
    expect(metaOnly).toContain('"Study A"');
    expect(metaOnly).toContain('ode forms show <form_type> --profile p1');
    expect(metaOnly).toContain('does not allow access to collected data');

    const withData = buildAgentPrompt(
      { ...profile, localToolsAllowData: true },
      null,
    );
    expect(withData).toContain('sensitive personal data');
  });
});
