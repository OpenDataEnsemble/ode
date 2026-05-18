/** Workspace-relative bundle segment for the active profile (matches Rust `bundle_segment`). */
export function bundleSegment(developerMode: boolean): 'active' | 'dev-local' {
  return developerMode ? 'dev-local' : 'active';
}

/** Workspace-relative path to bundle forms root (canonical `bundles/{segment}/forms`). */
export function bundleFormsRel(developerMode: boolean): string {
  return `bundles/${bundleSegment(developerMode)}/forms`;
}
