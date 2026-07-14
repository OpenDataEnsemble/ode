import axios from 'axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import {
  AttachmentsApi,
  Configuration,
  type CreateUserRequestRoleEnum,
  DataExportApi,
  DefaultApi,
  HealthApi,
  type UserListItem,
} from '../api/synkronus/generated';
import type { LoginRequest, LoginResponse } from '../types/auth';
import { ODE_VERSION } from '../version';

interface ApiErrorResponse {
  error?: string;
  message?: string;
  detail?: string;
  title?: string;
}

interface VersionInfo {
  server?: {
    version?: string;
  };
  version?: string;
}

const getApiBaseUrl = () => import.meta.env.VITE_API_URL || '/api';

const getApiOriginForGeneratedClient = (): string => {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  if (!baseUrl) return '';
  if (baseUrl === '/api') return '';
  return baseUrl.replace(/\/api$/, '');
};

const API_BASE_URL = getApiBaseUrl();
const GENERATED_CLIENT_BASE_PATH = getApiOriginForGeneratedClient();

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('expiresAt');
};

const getErrorMessage = (data: unknown): string | null => {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const typed = data as ApiErrorResponse;
    return typed.message || typed.error || typed.detail || typed.title || null;
  }
  return null;
};

const toApiError = (
  error: unknown,
  options: { redirectOnUnauthorized?: boolean } = {},
): Error => {
  const { redirectOnUnauthorized = true } = options;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const status = axiosError.response?.status;
    let errorMessage =
      getErrorMessage(axiosError.response?.data) || axiosError.message;

    if (status === 401) {
      if (redirectOnUnauthorized) {
        clearStoredAuth();
        window.location.href = '/';
        return new Error('Your session has expired. Please log in again.');
      }
      return new Error(errorMessage || 'Invalid username or password');
    }

    if (status === 0 || (status !== undefined && status >= 500)) {
      errorMessage = 'Server error: Please check if the API is running';
    } else if (!navigator.onLine) {
      errorMessage = 'No internet connection';
    }

    return new Error(errorMessage || 'Network error: Unable to reach API');
  }

  if (error instanceof Error) return error;
  return new Error('Network error: Unable to connect to the server');
};

const authHeader = () => {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const configuration = new Configuration({
  basePath: GENERATED_CLIENT_BASE_PATH,
  accessToken: () => localStorage.getItem('token') || '',
  baseOptions: {
    headers: {
      'x-ode-version': ODE_VERSION,
    },
  },
});

const defaultApi = new DefaultApi(configuration);
const dataExportApi = new DataExportApi(configuration);
const attachmentsApi = new AttachmentsApi(configuration);
const healthApi = new HealthApi(configuration);

async function requestJson<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'x-ode-version': ODE_VERSION,
    ...authHeader(),
  };
  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const responseData = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(
        getErrorMessage(responseData) || `HTTP error ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    throw toApiError(error);
  }
}

export const api = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const res = await defaultApi.login({
        xOdeVersion: ODE_VERSION,
        loginRequest: credentials,
      });
      return res.data as LoginResponse;
    } catch (error) {
      throw toApiError(error, { redirectOnUnauthorized: false });
    }
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const res = await defaultApi.refreshToken({
        xOdeVersion: ODE_VERSION,
        refreshTokenRequest: { refreshToken },
      });
      return res.data as LoginResponse;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getVersion(): Promise<VersionInfo> {
    try {
      const res = await defaultApi.getVersion({ xOdeVersion: ODE_VERSION });
      return res.data as VersionInfo;
    } catch (error) {
      throw toApiError(error, { redirectOnUnauthorized: false });
    }
  },

  async getHealth() {
    try {
      const res = await healthApi.getHealth();
      return res.data;
    } catch (error) {
      throw toApiError(error, { redirectOnUnauthorized: false });
    }
  },

  async get<T>(endpoint: string): Promise<T> {
    if (endpoint === '/app-bundle/versions') {
      const res = await defaultApi.getAppBundleVersions({
        xOdeVersion: ODE_VERSION,
      });
      return res.data as T;
    }
    return requestJson<T>(endpoint, 'GET');
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return requestJson<T>(endpoint, 'POST', data);
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return requestJson<T>(endpoint, 'PUT', data);
  },

  async delete<T>(endpoint: string): Promise<T> {
    return requestJson<T>(endpoint, 'DELETE');
  },

  async createUser(data: {
    username: string;
    password: string;
    role: string;
  }): Promise<{ username: string; role: string; createdAt: string }> {
    try {
      const res = await defaultApi.createUser({
        xOdeVersion: ODE_VERSION,
        createUserRequest: {
          ...data,
          role: data.role as CreateUserRequestRoleEnum,
        },
      });
      return res.data as { username: string; role: string; createdAt: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listUsers(): Promise<UserListItem[]> {
    try {
      const res = await defaultApi.listUsers({ xOdeVersion: ODE_VERSION });
      return res.data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async deleteUser(username: string): Promise<{ message: string }> {
    return requestJson<{ message: string }>(
      `/users/delete/${encodeURIComponent(username)}`,
      'DELETE',
    );
  },

  async resetPassword(data: {
    username: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    try {
      const res = await defaultApi.resetUserPassword({
        xOdeVersion: ODE_VERSION,
        resetUserPasswordRequest: data,
      });
      return res.data as { message: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    try {
      const res = await defaultApi.changePassword({
        xOdeVersion: ODE_VERSION,
        changePasswordRequest: data,
      });
      return res.data as { message: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async switchAppBundleVersion(version: string): Promise<{ message: string }> {
    try {
      const res = await defaultApi.switchAppBundleVersion({
        version,
        xOdeVersion: ODE_VERSION,
      });
      return res.data as { message: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getAppBundleManifest(): Promise<{
    version: string;
    files: Array<{ path: string; hash: string; size: number }>;
    hash: string;
  }> {
    try {
      const res = await defaultApi.getAppBundleManifest({
        xOdeVersion: ODE_VERSION,
      });
      return res.data as {
        version: string;
        files: Array<{ path: string; hash: string; size: number }>;
        hash: string;
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAppBundleChanges(current?: string, target?: string): Promise<any> {
    try {
      const res = await defaultApi.getAppBundleChanges({
        xOdeVersion: ODE_VERSION,
        current,
        target,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.data as any;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async downloadAppBundleFile(
    filePath: string,
    preview?: boolean,
  ): Promise<Blob> {
    try {
      const res = await defaultApi.downloadAppBundleFile(
        {
          path: filePath,
          xOdeVersion: ODE_VERSION,
          preview,
        },
        { responseType: 'blob' },
      );
      return res.data as unknown as Blob;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async uploadAppBundle(
    bundle: File,
    onProgress?: (percent: number) => void,
  ): Promise<{ manifest?: { version?: string }; version?: string }> {
    try {
      const requestConfig: AxiosRequestConfig = {};
      if (onProgress) {
        requestConfig.onUploadProgress = progress => {
          if (progress.total && progress.total > 0) {
            onProgress((progress.loaded / progress.total) * 100);
          }
        };
      }
      const res = await defaultApi.pushAppBundle(
        {
          xOdeVersion: ODE_VERSION,
          bundle,
        },
        requestConfig,
      );
      return res.data as { manifest?: { version?: string }; version?: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  /**
   * Download a binary response (ZIP, etc.) from an authenticated endpoint.
   */
  async downloadBlob(endpoint: string): Promise<Blob> {
    try {
      if (endpoint === '/dataexport/parquet') {
        const res = await dataExportApi.getParquetExportZip(
          { xOdeVersion: ODE_VERSION },
          { responseType: 'blob' },
        );
        return res.data as unknown as Blob;
      }
      if (endpoint === '/dataexport/raw-json') {
        const res = await dataExportApi.getRawJsonExportZip(
          { xOdeVersion: ODE_VERSION },
          { responseType: 'blob' },
        );
        return res.data as unknown as Blob;
      }
      if (endpoint === '/attachments/export-zip') {
        const res = await attachmentsApi.getAttachmentsExportZip(
          { xOdeVersion: ODE_VERSION },
          { responseType: 'blob' },
        );
        return res.data as unknown as Blob;
      }
    } catch (error) {
      throw toApiError(error);
    }

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'x-ode-version': ODE_VERSION,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const responseData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(
          getErrorMessage(responseData) || `HTTP error ${response.status}`,
        );
      }

      return response.blob();
    } catch (error) {
      throw toApiError(error);
    }
  },
};
