(function () {
  function diag(event, details) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          JSON.stringify({
            type: 'odeFormplayerHostDiagnostics',
            event: event,
            details: details || null,
          }),
          '*',
        );
      }
    } catch (_e) {
      // Ignore diagnostics transport failures.
    }
  }

  function readInitData() {
    const el = document.getElementById('ode-formplayer-init-data');
    if (!el) {
      diag('init-data-missing', null);
      return null;
    }
    try {
      const raw = el.textContent || '';
      return JSON.parse(raw);
    } catch (e) {
      diag('init-data-parse-failed', {
        message: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  diag('host-stub-start', { href: window.location.href });

  window.addEventListener('error', function (ev) {
    diag('window-error', {
      message: ev && ev.message ? String(ev.message) : 'unknown',
      source: ev && ev.filename ? String(ev.filename) : null,
      line: ev && typeof ev.lineno === 'number' ? ev.lineno : null,
      col: ev && typeof ev.colno === 'number' ? ev.colno : null,
    });
  });

  window.addEventListener('unhandledrejection', function (ev) {
    const reason = ev && 'reason' in ev ? ev.reason : null;
    diag('unhandled-rejection', {
      reason:
        typeof reason === 'string'
          ? reason
          : reason && typeof reason === 'object' && 'message' in reason
            ? String(reason.message)
            : String(reason),
    });
  });

  const initData = readInitData();

  window.ReactNativeWebView = {
    postMessage: function (m) {
      const raw = typeof m === 'string' ? m : JSON.stringify(m);
      try {
        const p = typeof m === 'string' ? JSON.parse(m) : m;
        if (p && p.type === 'formplayerReadyToReceiveInit') {
          diag('formplayer-ready', null);
          queueMicrotask(function () {
            if (typeof window.onFormInit === 'function') {
              diag('calling-onFormInit', null);
              window.onFormInit(initData);
            } else {
              diag('onFormInit-missing', null);
            }
          });
        }
      } catch (_e) {
        // ignore parse failures
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(raw, '*');
      }
    },
  };
})();
