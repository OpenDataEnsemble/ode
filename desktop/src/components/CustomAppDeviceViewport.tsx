import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  computeDeviceFitScale,
  formatDevicePixelRatioLabel,
  getCustomAppDevicePreset,
  isResponsiveDevicePreset,
  loadStoredDeviceViewport,
  resolveDeviceDimensions,
  resolveDevicePixelRatio,
  storeDeviceViewport,
  CUSTOM_APP_DEVICE_PRESETS,
  type CustomAppDevicePresetId,
} from '../lib/customAppDevicePresets';

export interface CustomAppDeviceViewportContext {
  fillFrame: boolean;
  devicePixelRatio: number;
}

export interface CustomAppDeviceViewportProps {
  /** Optional controls rendered on the left (Form preview: form/locale selectors). */
  toolbarStart?: ReactNode;
  children: (ctx: CustomAppDeviceViewportContext) => ReactNode;
}

export function CustomAppDeviceViewport({
  toolbarStart,
  children,
}: CustomAppDeviceViewportProps) {
  const [viewport, setViewport] = useState(loadStoredDeviceViewport);
  const { presetId, landscape } = viewport;

  const preset = getCustomAppDevicePreset(presetId);
  const responsive = isResponsiveDevicePreset(preset);
  const devicePixelRatio = resolveDevicePixelRatio(preset);
  const { width: deviceWidth, height: deviceHeight } = resolveDeviceDimensions(
    preset,
    landscape,
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (responsive) {
      setScale(1);
      return undefined;
    }
    const el = viewportRef.current;
    if (!el) {
      return undefined;
    }
    const updateScale = () => {
      setScale(
        computeDeviceFitScale(
          el.clientWidth,
          el.clientHeight,
          deviceWidth,
          deviceHeight,
        ),
      );
    };
    updateScale();
    const ro = new ResizeObserver(() => updateScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [deviceHeight, deviceWidth, responsive]);

  function persist(
    nextPresetId: CustomAppDevicePresetId,
    nextLandscape: boolean,
  ) {
    const next = { presetId: nextPresetId, landscape: nextLandscape };
    setViewport(next);
    storeDeviceViewport(nextPresetId, nextLandscape);
  }

  function onPresetChange(nextId: CustomAppDevicePresetId) {
    const nextLandscape = nextId === 'responsive' ? false : landscape;
    persist(nextId, nextLandscape);
  }

  function toggleOrientation() {
    if (responsive) {
      return;
    }
    persist(presetId, !landscape);
  }

  const scaledWidth = deviceWidth * scale;
  const scaledHeight = deviceHeight * scale;
  const scaleLabel = `${Math.round(scale * 100)}%`;
  const orientationLabel = landscape ? 'Landscape' : 'Portrait';

  const viewportControls = (
    <>
      <div className="custom-app-device-toolbar-controls">
        <select
          aria-label="Viewport"
          value={presetId}
          onChange={e =>
            onPresetChange(e.target.value as CustomAppDevicePresetId)
          }>
          {CUSTOM_APP_DEVICE_PRESETS.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary btn-icon custom-app-device-orientation-btn"
          disabled={responsive}
          aria-label="Switch orientation"
          title="Switch orientation"
          onClick={toggleOrientation}>
          <span className="material-symbols-outlined" aria-hidden>
            screen_rotation
          </span>
        </button>
      </div>
      {!responsive ? (
        <span className="muted custom-app-device-toolbar-meta">
          {deviceWidth} × {deviceHeight} CSS ·{' '}
          {formatDevicePixelRatioLabel(devicePixelRatio)} · {orientationLabel} ·{' '}
          {scaleLabel}
        </span>
      ) : (
        <span className="muted custom-app-device-toolbar-meta">
          Fills available panel space
        </span>
      )}
    </>
  );

  return (
    <div className="custom-app-device-shell">
      <div
        className={`custom-app-device-toolbar${toolbarStart ? ' custom-app-device-toolbar--split' : ''}`}>
        {toolbarStart ? (
          <div className="custom-app-device-toolbar-start">{toolbarStart}</div>
        ) : null}
        <div className="custom-app-device-toolbar-end">{viewportControls}</div>
      </div>

      <div
        ref={viewportRef}
        className={`custom-app-device-viewport${responsive ? ' custom-app-device-viewport--responsive' : ''}`}>
        {responsive ? (
          children({ fillFrame: false, devicePixelRatio: 1 })
        ) : (
          <div
            className="custom-app-device-scaler"
            style={{ width: scaledWidth, height: scaledHeight }}>
            <div
              className="custom-app-device-frame"
              style={{
                width: deviceWidth,
                height: deviceHeight,
                transform: `scale(${scale})`,
              }}>
              {children({ fillFrame: true, devicePixelRatio })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
