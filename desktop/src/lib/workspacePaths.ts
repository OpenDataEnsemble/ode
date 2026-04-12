/** Deterministic layout under a profile workspace root (matches Rust). */
export function workspaceSqlitePath(workspaceRoot: string): string {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = workspaceRoot.replace(/[/\\]+$/, '');
  return `${base}${sep}sqlite${sep}custodian.sqlite3`;
}

export function workspaceAttachmentsDir(workspaceRoot: string): string {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = workspaceRoot.replace(/[/\\]+$/, '');
  return `${base}${sep}attachments`;
}
