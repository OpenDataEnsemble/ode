import type { LoginRequest, LoginResponse, RefreshRequest } from '../types/auth'

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  // Check if we're in development (Vite proxy) or production
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // Use proxy in development, direct URL in production
  return import.meta.env.DEV ? '/api' : 'http://localhost:8080'
}

const API_BASE_URL = getApiBaseUrl()

interface ApiErrorResponse {
  error?: string
  message?: string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token')
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      
      try {
        const errorData: ApiErrorResponse = await response.json()
        // API returns { error: "...", message: "..." } format
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage
      }
      
      // Provide more specific error messages
      if (response.status === 401) {
        errorMessage = errorMessage || 'Invalid username or password'
      } else if (response.status === 0 || response.status >= 500) {
        errorMessage = 'Server error: Please check if the API is running'
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection'
      }
      
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw API errors as-is
      throw error
    }
    // Network errors, CORS errors, etc.
    throw new Error('Network error: Unable to connect to the server. Please check if the API is running at ' + API_BASE_URL)
  }
}

export const api = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const payload: RefreshRequest = { refreshToken }
    return request<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'GET' })
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  async delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' })
  },
}

