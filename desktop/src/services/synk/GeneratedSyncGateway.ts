import {
  Configuration,
  DefaultApi,
  FetchError,
  type LoginRequest,
  type Observation,
  ResponseError,
  type SyncPullRequest,
  type SyncPushRequest,
} from '../../generated/synkronus-client';
import { SyncHttpError } from './syncErrors';
import {
  DEFAULT_OBSERVATION_FORM_TYPE,
  DEFAULT_OBSERVATION_FORM_VERSION,
} from '../../lib/observation';
import { createLogger } from '../../lib/logger';
import { SYNKRONUS_CLIENT_VERSION } from '../../lib/synkConstants';
import type {
  ApiObservation,
  AuthSession,
  ObservationRecord,
  SyncLoginRequest,
} from '../../types/domain';
import type {
  PullRequest,
  PullResult,
  PushRequest,
  PushResult,
  RefreshSessionRequest,
  SyncGateway,
} from './SyncGateway';

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? new Date().toISOString()
      : value.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? new Date().toISOString()
      : d.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? new Date().toISOString()
      : d.toISOString();
  }
  return new Date().toISOString();
}

function parseMaybeDate(value?: string | null): Date {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapObservationToApiObservation(value: Observation): ApiObservation {
  const raw = value as Observation & { updated_at?: unknown };
  return {
    observationId: value.observation_id,
    data: value.data,
    formType: value.form_type,
    updatedAt: toIsoTimestamp(raw.updated_at),
  };
}

function mapObservationToOpenApi(observation: ObservationRecord): Observation {
  const x = observation.extras;
  const updatedAt = parseMaybeDate(observation.updatedAt);
  const createdAt = x?.createdAt ? parseMaybeDate(x.createdAt) : updatedAt;
  const payloadObject =
    observation.payload && typeof observation.payload === 'object'
      ? (observation.payload as Record<string, unknown>)
      : {};

  const geo =
    x?.geolocation != null && typeof x.geolocation === 'object'
      ? (x.geolocation as Record<string, unknown>)
      : null;

  return {
    observation_id: observation.id,
    form_type: observation.formType ?? DEFAULT_OBSERVATION_FORM_TYPE,
    form_version: x?.formVersion ?? DEFAULT_OBSERVATION_FORM_VERSION,
    data: payloadObject,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted: x?.deleted ?? false,
    synced_at: x?.syncedAt ? parseMaybeDate(x.syncedAt) : null,
    geolocation: geo,
    author: x?.author ?? null,
    device_id: x?.deviceId ?? null,
    tags: x?.tags ?? null,
  };
}

const MAX_ERROR_BODY_LENGTH = 400;
const syncLogger = createLogger('sync-gateway');

function truncate(value: string, max = MAX_ERROR_BODY_LENGTH): string {
  return value.length <= max ? value : `${value.slice(0, max)}...`;
}

function tryExtractJsonMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const messageFields = ['message', 'detail', 'error', 'description'];
  for (const field of messageFields) {
    const rawValue = candidate[field];
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      return rawValue.trim();
    }
  }
  return null;
}

async function toSyncGatewayError(
  operation: 'login' | 'refresh' | 'pull' | 'push',
  baseUrl: string,
  error: unknown,
): Promise<Error> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const endpointByOperation: Record<typeof operation, string> = {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    pull: '/api/sync/pull',
    push: '/api/sync/push',
  };
  const attemptedEndpoint = `${normalizedBase}${endpointByOperation[operation]}`;

  if (error instanceof ResponseError) {
    let responseDetails = '';

    try {
      const contentType = error.response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const parsed = (await error.response.clone().json()) as unknown;
        const jsonMessage = tryExtractJsonMessage(parsed);
        if (jsonMessage) {
          responseDetails = jsonMessage;
        } else {
          responseDetails = truncate(JSON.stringify(parsed));
        }
      } else {
        const text = (await error.response.clone().text()).trim();
        if (text.length > 0) {
          responseDetails = truncate(text);
        }
      }
    } catch {
      // Ignore response parse failures and fall back to status-only details.
    }

    const statusLine =
      `${error.response.status} ${error.response.statusText}`.trim();
    const endpoint = error.response.url || baseUrl;
    const detailSuffix = responseDetails ? ` | ${responseDetails}` : '';
    return new SyncHttpError(
      `Synk ${operation} failed (HTTP ${statusLine}) at ${endpoint}${detailSuffix}`,
      error.response.status,
      operation,
    );
  }

  if (error instanceof FetchError) {
    const causeMessage =
      error.cause?.message?.trim() || 'network request failed before response';
    return new Error(
      `Synk ${operation} failed before receiving an HTTP response at ${attemptedEndpoint}: ${causeMessage}. This usually indicates network, DNS, TLS/certificate, CORS, or server reachability issues (not invalid credentials).`,
    );
  }

  if (error instanceof Error) {
    return new Error(`Synk ${operation} failed: ${error.message}`);
  }

  return new Error(`Synk ${operation} failed due to an unknown error.`);
}

export class GeneratedSyncGateway implements SyncGateway {
  private createApi(baseUrl: string, token: string) {
    const configuration = new Configuration({
      basePath: baseUrl.replace(/\/+$/, ''),
      accessToken: token,
    });
    return new DefaultApi(configuration);
  }

  async login(request: SyncLoginRequest): Promise<AuthSession> {
    try {
      const api = this.createApi(request.baseUrl, '');
      const loginRequest: LoginRequest = {
        username: request.username,
        password: request.password,
      };
      const auth = await api.login({
        xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        loginRequest,
      });
      return {
        baseUrl: request.baseUrl,
        token: auth.token,
        refreshToken: auth.refreshToken,
        expiresAt: auth.expiresAt,
      };
    } catch (error) {
      syncLogger.warn('Login request failed', {
        baseUrl: request.baseUrl,
        error,
      });
      throw await toSyncGatewayError('login', request.baseUrl, error);
    }
  }

  async refreshSession(request: RefreshSessionRequest): Promise<AuthSession> {
    try {
      const api = this.createApi(request.baseUrl, '');
      const auth = await api.refreshToken({
        xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        refreshTokenRequest: { refreshToken: request.refreshToken },
      });
      return {
        baseUrl: request.baseUrl,
        token: auth.token,
        refreshToken: auth.refreshToken,
        expiresAt: auth.expiresAt,
      };
    } catch (error) {
      syncLogger.warn('Refresh token request failed', {
        baseUrl: request.baseUrl,
        error,
      });
      throw await toSyncGatewayError('refresh', request.baseUrl, error);
    }
  }

  async pull(request: PullRequest): Promise<PullResult> {
    try {
      const api = this.createApi(request.baseUrl, request.token);
      const gen =
        request.repositoryGeneration != null && request.repositoryGeneration > 0
          ? request.repositoryGeneration
          : undefined;
      const syncPullRequest: SyncPullRequest = {
        client_id: request.clientId,
        schema_types: request.schemaTypes,
        since: request.sinceVersion
          ? { version: request.sinceVersion }
          : undefined,
        ...(gen != null ? { repository_generation: gen } : {}),
      };

      const response = await api.syncPull({
        xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        syncPullRequest,
        limit: request.limit,
        ...(gen != null ? { xRepositoryGeneration: gen } : {}),
      });

      return {
        observations: (response.records ?? []).map(
          mapObservationToApiObservation,
        ),
        hasMore: response.has_more ?? false,
        currentVersion: response.current_version,
        changeCutoff: response.change_cutoff,
        repositoryGeneration: response.repository_generation,
      };
    } catch (error) {
      syncLogger.warn('Pull request failed', {
        baseUrl: request.baseUrl,
        error,
      });
      throw await toSyncGatewayError('pull', request.baseUrl, error);
    }
  }

  async push(request: PushRequest): Promise<PushResult> {
    try {
      const api = this.createApi(request.baseUrl, request.token);
      const payloadObservations = request.observations.map(
        mapObservationToOpenApi,
      );
      const gen =
        request.repositoryGeneration != null && request.repositoryGeneration > 0
          ? request.repositoryGeneration
          : undefined;
      const syncPushRequest: SyncPushRequest = {
        transmission_id: crypto.randomUUID(),
        client_id: request.clientId,
        records: payloadObservations,
        ...(gen != null ? { repository_generation: gen } : {}),
      };

      const response = await api.syncPush({
        xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        syncPushRequest,
        ...(gen != null ? { xRepositoryGeneration: gen } : {}),
      });
      const failedIds = (response.failed_records ?? [])
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const candidate = entry as Record<string, unknown>;
          const id = candidate.id ?? candidate.observation_id;
          return typeof id === 'string' ? id : null;
        })
        .filter((id): id is string => Boolean(id));

      const acceptedIds = request.observations
        .map(obs => obs.id)
        .filter(id => !failedIds.includes(id))
        .slice(0, Math.max(response.success_count, 0));

      return {
        acceptedIds,
        failedIds,
        warningCount: response.warnings?.length ?? 0,
        repositoryGeneration: response.repository_generation,
      };
    } catch (error) {
      syncLogger.warn('Push request failed', {
        baseUrl: request.baseUrl,
        error,
      });
      throw await toSyncGatewayError('push', request.baseUrl, error);
    }
  }
}
