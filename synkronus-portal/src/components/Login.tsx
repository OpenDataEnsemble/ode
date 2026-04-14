import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
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
    const fetchVersion = async () => {
      try {
        const data = await api.getVersion();
        const version = data.server?.version || data.version;
        if (version) {
          setServerVersion(version);
          return;
        }
      } catch {
        // Continue to health fallback below.
      }

      try {
        const health = await api.getHealth();
        if (typeof health?.version === 'string') {
          setServerVersion(health.version);
          return;
        }
      } catch (err) {
        console.debug('Failed to fetch server version:', err);
      }

      setServerVersion('Unknown');
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
            <span className="version-text">
              Server v{serverVersion.replace(/^v+/i, '')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
