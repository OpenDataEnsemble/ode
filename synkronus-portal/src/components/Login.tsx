import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button, Input } from '@ode/components/react-web';

import odeLogo from '../assets/ode-logo-round.png';
import dashboardBackgroundDark from '../assets/dashboard-background.png';
import dashboardBackgroundLight from '../assets/dashboard-background-light.png';
import './Login.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const { login } = useAuth();
  const { resolvedTheme } = useTheme();

  const loginBackground =
    resolvedTheme === 'light'
      ? dashboardBackgroundLight
      : dashboardBackgroundDark;

  useEffect(() => {
    // Fetch server version on component mount
    const fetchVersion = async () => {
      try {
        // Try version endpoint first
        let response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/version`, {
          headers: {
            'x-formulus-version': '1.0.0'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setServerVersion(data.server?.version || data.version || 'Unknown');
          return;
        }
        
        // If version fails, try health endpoint (might have version info)
        response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`);
        if (response.ok) {
          const text = await response.text();
          // Health endpoint might return JSON with version info
          try {
            const healthData = JSON.parse(text);
            if (healthData.version) {
              setServerVersion(healthData.version);
              return;
            }
          } catch {
            // Health returns plain text, use default
            setServerVersion('1.0.0');
            return;
          }
        }
        
        // Set a default version if both fail
        setServerVersion('1.0.0');
      } catch (err) {
        // Silently fail - version is optional, set default
        console.debug('Failed to fetch server version:', err);
        setServerVersion('1.0.0');
      }
    };

    fetchVersion();
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setError(null);
    setLoading(true);

    try {
      await login({ username, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-container"
      style={
        { '--login-bg-image': `url(${loginBackground})` } as React.CSSProperties
      }>
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
            className="login-button">
            Sign In
          </Button>
        </form>
        
        {serverVersion && (
          <div className="server-version">
            <span className="version-text">Server v{serverVersion}</span>
          </div>
        )}
      </div>
    </div>
  );
}
