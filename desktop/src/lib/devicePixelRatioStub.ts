/** Returns an inline script that overrides `window.devicePixelRatio` before app code runs. */
export function buildDevicePixelRatioInjectionScript(
  devicePixelRatio: number,
): string {
  if (devicePixelRatio <= 0 || Math.abs(devicePixelRatio - 1) < 0.001) {
    return '';
  }
  const dprLiteral = JSON.stringify(devicePixelRatio);
  return (
    '<script id="ode-device-pixel-ratio-stub">' +
    '(function(){try{' +
    `Object.defineProperty(window,"devicePixelRatio",{get:function(){return ${dprLiteral};},configurable:true});` +
    '}catch(e){}})();' +
    '</script>'
  );
}
