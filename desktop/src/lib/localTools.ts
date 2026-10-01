/**
 * Agent-facing pointers to the `ode` local-tools CLI (see desktop/docs/LOCAL_TOOLS.md).
 */
import type { ServerProfile } from '../types/domain';

type ProfileLike = Pick<
  ServerProfile,
  | 'id'
  | 'label'
  | 'localToolsEnabled'
  | 'localToolsAllowData'
  | 'localToolsAllowAuthoring'
  | 'localToolsAllowPush'
>;

export function localToolsEnabled(profile: ProfileLike): boolean {
  return profile.localToolsEnabled ?? true;
}

/** Shell-ready command for the CLI; falls back to `ode` (on PATH) when the path is unknown. */
export function cliCommand(cliPath: string | null | undefined): string {
  const p = cliPath?.trim();
  if (!p) {
    return 'ode';
  }
  return /\s/.test(p) ? `"${p}"` : p;
}

/**
 * MCP client config for `ode mcp` in the common `mcpServers` format (Claude Desktop, Cursor, …).
 * Zed uses `context_servers` and VS Code `servers` with the same command/args (see LOCAL_TOOLS.md).
 */
export function buildMcpConfig(cliPath: string | null | undefined): string {
  const command = cliPath?.trim() || 'ode';
  return JSON.stringify(
    { mcpServers: { ode: { command, args: ['mcp'] } } },
    null,
    2,
  );
}

/**
 * Comment lines (without comment prefix) for generated scripts.
 * Keep in sync with Rust `local_api::hint_lines` (written into exported snippet files).
 */
export function localToolsHintLines(
  profile: ProfileLike | null | undefined,
  cliPath: string | null | undefined,
): string[] {
  if (!profile || !localToolsEnabled(profile)) {
    return [];
  }
  const cli = cliCommand(cliPath);
  return [
    'AI assistants / agents: form definitions for these tables (question labels,',
    "coded choice values, linked sub-forms) are available from ODE Desktop's CLI:",
    `  ${cli} forms list --profile ${profile.id}`,
    `  ${cli} forms show <form_type> --profile ${profile.id}`,
    `Profile: ${profile.label.trim()}. Run ${cli} --help for details (JSON output).`,
  ];
}

/** Initial prompt a user can paste into an AI assistant (Profiles → Local tools). */
export function buildAgentPrompt(
  profile: ProfileLike,
  cliPath: string | null | undefined,
): string {
  const cli = cliCommand(cliPath);
  const dataLine = profile.localToolsAllowData
    ? `This profile allows agent access to collected data and attachments: \`${cli} data export --profile ${profile.id} --form <form_type> --destination <existing_folder>\` writes Parquet files, export_manifest.json (a data dictionary), and load snippets. Treat the data as sensitive personal data: only read what the task needs, and do not send raw records or attachments to external services unless I explicitly ask.`
    : 'This profile does not allow access to collected data or attachments. Work with form metadata only, and do not try to read the ODE workspace, database, or attachment folders directly.';
  const authoringLine = !profile.localToolsAllowAuthoring
    ? "Agents may not manage this profile's app bundle (developer mode, publishing); you can still edit form files I point you to and validate them."
    : profile.localToolsAllowPush
      ? `You may manage this profile's custom app (\`${cli} app status --profile ${profile.id}\`) and publish it with \`${cli} app push\`, but only after showing me the dry-run result and getting my explicit confirmation.`
      : `You may manage this profile's custom app (\`${cli} app status --profile ${profile.id}\`) and prepare a publish with \`${cli} app push\` (dry run). Publishing itself is not allowed for agents on this profile.`;
  return [
    `I use ODE Desktop (Open Data Ensemble) for the data collection project "${profile.label.trim()}". You can read its form definitions with the ODE command-line tool:`,
    '',
    `  ${cli} --help`,
    `  ${cli} forms list --profile ${profile.id}`,
    `  ${cli} forms show <form_type> --profile ${profile.id}`,
    '',
    '`forms show` returns JSON with the questions in order: labels per language, types, coded choice values, skip-logic rules, pages/groups, and linked sub-forms (sub-observations). All output, including errors, is JSON.',
    '',
    `If you edit form files (schema.json / ui.json), run \`${cli} forms validate <form_folder>\` afterwards and fix all errors. When you change a form, bump its "version" in schema.json.`,
    '',
    `For step-by-step guides, run \`${cli} skills list\` and \`${cli} skills show <name>\` (e.g. ode-describe-form to explain a form, ode-analyze-export for data analysis, ode-edit-form for changing forms, ode-new-project to start a new app).`,
    '',
    authoringLine,
    '',
    dataLine,
    '',
    'Parquet exports (one file per form type) and load snippets for R, Python, Stata, and Julia are created in ODE Desktop → Export. Documentation: https://opendataensemble.org/docs/',
  ].join('\n');
}
