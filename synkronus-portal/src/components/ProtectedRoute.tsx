import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Login } from './Login'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, refreshAuth } = useAuth()

  useEffect(() => {
    // Check if token is expired and refresh if needed
    const expiresAt = localStorage.getItem('expiresAt')
    if (expiresAt && isAuthenticated) {
      const expirationTime = parseInt(expiresAt, 10) * 1000
      const now = Date.now()
      const timeUntilExpiry = expirationTime - now

      // Refresh token if it expires in less than 5 minutes
      if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
        refreshAuth().catch(() => {
          // If refresh fails, logout will be handled in AuthContext
        })
      }
    }
  }, [isAuthenticated, refreshAuth])

  if (!isAuthenticated) {
    return <Login />
  }

  return <>{children}</>
}

