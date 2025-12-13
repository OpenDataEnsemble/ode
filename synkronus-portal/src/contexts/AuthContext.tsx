import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../services/api'
import type { LoginRequest, User, AuthState } from '../types/auth'

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  })

  // Load auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refreshToken')
    const userStr = localStorage.getItem('user')

    if (token && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr)
        setAuthState({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
        })
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
      }
    }
  }, [])

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await api.login(credentials)
      
      // Decode JWT to get user info (simple base64 decode of payload)
      const tokenParts = response.token.split('.')
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format')
      }
      
      const payload = JSON.parse(atob(tokenParts[1]))
      const user: User = {
        username: payload.username || credentials.username,
        role: payload.role || 'user',
      }

      // Store tokens and user info
      localStorage.setItem('token', response.token)
      localStorage.setItem('refreshToken', response.refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('expiresAt', response.expiresAt.toString())

      setAuthState({
        user,
        token: response.token,
        refreshToken: response.refreshToken,
        isAuthenticated: true,
      })
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('expiresAt')
    setAuthState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  }

  const refreshAuth = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      logout()
      return
    }

    try {
      const response = await api.refreshToken(refreshToken)
      
      const tokenParts = response.token.split('.')
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format')
      }
      
      const payload = JSON.parse(atob(tokenParts[1]))
      const user: User = {
        username: payload.username || authState.user?.username || '',
        role: payload.role || authState.user?.role || 'user',
      }

      localStorage.setItem('token', response.token)
      localStorage.setItem('refreshToken', response.refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('expiresAt', response.expiresAt.toString())

      setAuthState({
        user,
        token: response.token,
        refreshToken: response.refreshToken,
        isAuthenticated: true,
      })
    } catch (error) {
      // Refresh failed, logout
      logout()
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

