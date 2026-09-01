/**
 * CameraX (react-native-camera-kit) binds to the Activity. Unmount is async:
 * onDetachedFromWindow() unbinds, but a queued setupCamera listener can bind
 * again after detach, so the next <Camera> opens while a session is still live.
 *
 * Hold a short process-wide cooldown after each release before mounting again.
 */

export const CAMERA_REOPEN_DELAY_MS = 400;

let releasedAtMs = 0;

export function markCameraReleased(now = Date.now()): void {
  releasedAtMs = now;
}

export function delayBeforeCameraOpen(now = Date.now()): number {
  return Math.max(0, releasedAtMs + CAMERA_REOPEN_DELAY_MS - now);
}

/** Test-only. */
export function resetCameraReopenGate(): void {
  releasedAtMs = 0;
}
