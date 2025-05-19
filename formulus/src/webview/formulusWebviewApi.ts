const formulusApi = `
  (function() {
    window.formulus = {
      getVersion: function() {
        return "1.0.0";
      },
      openFormplayer: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'openFormplayer'
        }));
      }
    };
  })();
`;

export default formulusApi;