import {
  buildAgentPrompt,
  buildMcpConfig,
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

  it('builds an MCP config with an unquoted command path', () => {
    const cfg = JSON.parse(buildMcpConfig('C:\\Program Files\\ODE\\ode.exe'));
    expect(cfg.mcpServers.ode).toEqual({
      command: 'C:\\Program Files\\ODE\\ode.exe',
      args: ['mcp'],
    });
    expect(JSON.parse(buildMcpConfig(null)).mcpServers.ode.command).toBe('ode');
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
    expect(metaOnly).toContain('ode forms validate <form_folder>');

    const withData = buildAgentPrompt(
      { ...profile, localToolsAllowData: true },
      null,
    );
    expect(withData).toContain('sensitive personal data');
    expect(withData).toContain('ode data export --profile p1 --form');
    expect(metaOnly).not.toContain('data export');
    expect(metaOnly).toContain('ode skills list');
    expect(metaOnly).toContain('may not manage');

    const authoring = buildAgentPrompt(
      { ...profile, localToolsAllowAuthoring: true },
      null,
    );
    expect(authoring).toContain('ode app status --profile p1');
    expect(authoring).toContain('Publishing itself is not allowed');
    const push = buildAgentPrompt(
      { ...profile, localToolsAllowAuthoring: true, localToolsAllowPush: true },
      null,
    );
    expect(push).toContain('explicit confirmation');
  });
});
