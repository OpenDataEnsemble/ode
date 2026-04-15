(function () {
  function readInitData() {
    const el = document.getElementById('ode-formplayer-init-data');
    if (!el) {
      return null;
    }
    try {
      const raw = el.textContent || '';
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }

  const initData = readInitData();

  window.ReactNativeWebView = {
    postMessage: function (m) {
      const raw = typeof m === 'string' ? m : JSON.stringify(m);
      try {
        const p = typeof m === 'string' ? JSON.parse(m) : m;
        if (p && p.type === 'formplayerReadyToReceiveInit') {
          queueMicrotask(function () {
            if (typeof window.onFormInit === 'function') {
              window.onFormInit(initData);
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
