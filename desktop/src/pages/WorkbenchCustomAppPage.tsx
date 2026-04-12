/**
 * Custom app WebView (Workbench) — full bridge + CSP tracked in plan; placeholder UI.
 */
export function WorkbenchCustomAppPage() {
  return (
    <div className="page workbench-page">
      <header className="page-header">
        <h2>Custom app</h2>
        <p className="page-lead">
          Host the bundle custom_app entry with injected{' '}
          <code>formulusAPI</code> (parity with Formulus).
        </p>
      </header>
      <section className="card">
        <p className="muted">
          Not yet wired — requires bundle resolution + WebView.
        </p>
      </section>
    </div>
  );
}
