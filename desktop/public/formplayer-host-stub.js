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

  /**
   * ODE Desktop: deliver bridge *_response to pending Formulus promises without
   * relying on postMessage from the outer shell (unreliable for srcdoc iframes in WebView2).
   */
  function deliverBridgeResponseBody(body) {
    if (!body || !body.type || !body.messageId) {
      return;
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify(body),
      }),
    );
  }

  window.__odeFormplayerDeliverBridgeResponse = function (
    requestType,
    messageId,
    payload,
  ) {
    if (requestType === 'openFormplayer') {
      var result = payload && payload.result;
      console.warn('[SUBOBS_DEBUG] host-stub.deliverBridgeResponse', {
        messageId: messageId,
        status: result && result.status,
        formType: result && result.formType,
        formDataKeys:
          result &&
          result.formData &&
          typeof result.formData === 'object'
            ? Object.keys(result.formData)
            : [],
      });
    }
    var responseType = requestType + '_response';
    var body = { type: responseType, messageId: messageId };
    if (payload && typeof payload === 'object') {
      if ('result' in payload) body.result = payload.result;
      if ('error' in payload) body.error = payload.error;
    }
    deliverBridgeResponseBody(body);
  };

  /** Same-origin broadcast fallback when the outer shell cannot postMessage into srcdoc iframes (WebView2). */
  if (typeof BroadcastChannel !== 'undefined') {
    var bridgeResponseChannel = new BroadcastChannel(
      'ode-formplayer-bridge-response',
    );
    bridgeResponseChannel.onmessage = function (event) {
      deliverBridgeResponseBody(event.data);
    };
  }
})();
