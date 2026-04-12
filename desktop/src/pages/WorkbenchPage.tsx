/**
 * Forms / app workbench — bundle tooling, formplayer, and custom-app testbed (stubs; see ODE Desktop plan).
 */
export function WorkbenchPage() {
  return (
    <div className="page workbench-page">
      <header className="page-header">
        <h2>Forms / app workbench</h2>
        <p className="page-lead">
          Develop and test collection experiences: app bundles, JSON Forms
          (formplayer), and custom apps — aligned with Formulus.
        </p>
      </header>
      <section className="card">
        <h3>Bundles</h3>
        <p>
          Select or sync app bundles from Synkronus, cache locally, and prepare
          deploy (tier-gated confirmations).
        </p>
        <p className="muted">Not yet wired — tracked in implementation plan.</p>
      </section>
      <section className="card">
        <h3>Form preview</h3>
        <p>
          Embed formplayer build with the same <code>FormInitData</code>{' '}
          contract as Formulus.
        </p>
        <p className="muted">
          Formplayer assets: run copy script from formplayer package.
        </p>
      </section>
      <section className="card">
        <h3>Custom app</h3>
        <p>
          WebView with injected <code>formulusAPI</code> for parity with mobile
          custom apps.
        </p>
        <p className="muted">Not yet wired.</p>
      </section>
    </div>
  );
}
