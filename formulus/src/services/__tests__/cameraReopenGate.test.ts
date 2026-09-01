import {
  CAMERA_REOPEN_DELAY_MS,
  delayBeforeCameraOpen,
  markCameraReleased,
  resetCameraReopenGate,
} from '../cameraReopenGate';

describe('cameraReopenGate', () => {
  afterEach(() => {
    resetCameraReopenGate();
  });

  it('allows an immediate first open', () => {
    expect(delayBeforeCameraOpen(1_000)).toBe(0);
  });

  it('holds the reopen delay after a release', () => {
    markCameraReleased(1_000);
    expect(delayBeforeCameraOpen(1_000)).toBe(CAMERA_REOPEN_DELAY_MS);
    expect(delayBeforeCameraOpen(1_000 + 150)).toBe(
      CAMERA_REOPEN_DELAY_MS - 150,
    );
    expect(delayBeforeCameraOpen(1_000 + CAMERA_REOPEN_DELAY_MS)).toBe(0);
  });
});
