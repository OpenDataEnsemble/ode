import { useAuth } from '../contexts/AuthContext'
import './Dashboard.css'

export function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Synkronus Portal</h1>
        <div className="user-info">
          <span>Welcome, {user?.username}</span>
          <span className="role-badge">{user?.role}</span>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>
      
      <main className="dashboard-content">
        <div className="welcome-section">
          <h2>Dashboard</h2>
          <p>You are successfully authenticated!</p>
        </div>
      </main>
    </div>
  )
}

