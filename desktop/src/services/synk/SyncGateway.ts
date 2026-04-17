import type {
  ApiObservation,
  AuthSession,
  ObservationRecord,
  SyncLoginRequest,
} from '../../types/domain';

export interface PullResult {
  observations: ApiObservation[];
  hasMore: boolean;
  currentVersion: number;
  changeCutoff: number;
  repositoryGeneration: number;
}

export interface PushResult {
  acceptedIds: string[];
  failedIds: string[];
  warningCount: number;
  repositoryGeneration: number;
}

export interface PullRequest {
  baseUrl: string;
  token: string;
  clientId: string;
  schemaTypes?: string[];
  sinceVersion?: number;
  limit?: number;
  /** Monotonic repository epoch; omit for first sync (server treats as 1). */
  repositoryGeneration?: number;
}

export interface PushRequest {
  baseUrl: string;
  token: string;
  clientId: string;
  observations: ObservationRecord[];
  repositoryGeneration?: number;
}

export interface RefreshSessionRequest {
  baseUrl: string;
  refreshToken: string;
}

export interface SyncGateway {
  login(request: SyncLoginRequest): Promise<AuthSession>;
  refreshSession(request: RefreshSessionRequest): Promise<AuthSession>;
  pull(request: PullRequest): Promise<PullResult>;
  push(request: PushRequest): Promise<PushResult>;
}

export { SyncHttpError, isSyncHttpUnauthorized } from './syncErrors';
