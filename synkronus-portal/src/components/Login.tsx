import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button, Input } from "@ode/components/react-web";

import odeLogo from '../assets/ode_logo.png'
import './Login.css'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    setError(null)
    setLoading(true)

    try {
      await login({ username, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo-section">
          <img src={odeLogo} alt="ODE Logo" className="login-logo" />
          <h1>Synkronus Portal</h1>
        </div>
        <h2>Sign In</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <Input
              label="Username"
              type="text"
              value={username}
              onChangeText={setUsername}
              required
              disabled={loading}
              className="login-input"
            />
          </div>
          
          <div className="form-group">
            <Input
              label="Password"
              type="password"
              value={password}
              onChangeText={setPassword}
              required
              disabled={loading}
              className="login-input"
            />
          </div>
          
          <Button
            variant="primary"
            onPress={() => handleSubmit()}
            disabled={loading}
            loading={loading}
            className="login-button"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}

