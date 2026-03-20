import { isNotFoundError, isVersionMismatchError } from '../api/synkronus/Auth';
import { serverConfigService } from './ServerConfigService';

/** Server responds on /health but app-bundle returned 404 — nothing published yet. */
export const APP_BUNDLE_NOT_PUBLISHED_USER_MESSAGE =
  'The server is online, but no app bundle is available yet. Ask an administrator to publish an app bundle for this server, or try again later.';

/** /health did not return a successful response — URL or connectivity problem. */
export const APP_BUNDLE_SERVER_UNAVAILABLE_USER_MESSAGE =
  'Could not reach the server. Check the server URL, your network connection, and that the service is running.';

function isBundleZipHttpNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    /\bHTTP\s+404\b/i.test(error.message) &&
    error.message.toLowerCase().includes('bundle')
  );
}

function isAppBundleNotFoundError(error: unknown): boolean {
  return isNotFoundError(error) || isBundleZipHttpNotFound(error);
}

/**
 * User-facing text for app bundle download/update failures (manifest or zip).
 * For 404, uses GET /health to distinguish "server up, no bundle" vs unreachable server.
 */
export async function getUserFacingAppBundleUpdateErrorMessage(
  error: unknown,
): Promise<string> {
  if (isVersionMismatchError(error)) {
    return (error as Error).message;
  }

  const serverUrl = await serverConfigService.getServerUrl();
  if (serverUrl && isAppBundleNotFoundError(error)) {
    const healthy = await serverConfigService.isHealthEndpointOk(serverUrl);
    return healthy
      ? APP_BUNDLE_NOT_PUBLISHED_USER_MESSAGE
      : APP_BUNDLE_SERVER_UNAVAILABLE_USER_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'App sync failed';
}
