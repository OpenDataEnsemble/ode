import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import odeLogo from '../assets/ode_logo.png'
import './Dashboard.css'

// Get API base URL (same logic as api.ts)
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  return import.meta.env.DEV ? '/api' : 'http://localhost:8080'
}

type TabType = 'overview' | 'app-bundles' | 'users' | 'data-export' | 'system'

interface AppBundleVersion {
  version: string
  createdAt?: string
  isActive?: boolean
}

interface AppBundleManifest {
  version: string
  files: Array<{ path: string; hash: string; size: number }>
  hash: string
}

interface AppBundleChanges {
  compare_version_a?: string
  compare_version_b?: string
  added?: Array<{ path: string; hash: string; size: number }>
  removed?: Array<{ path: string; hash: string; size: number }>
  modified?: Array<{ path: string; hash_a: string; hash_b: string; size_a: number; size_b: number }>
}

interface AppBundleVersionsResponse {
  versions: string[]
}

interface User {
  username: string
  role: string
  createdAt?: string
}

interface SystemInfo {
  server?: {
    version: string
  }
  build?: {
    commit?: string
    build_time?: string
  }
  version?: string
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [appBundles, setAppBundles] = useState<AppBundleVersion[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // User management modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  // Form states
  const [createUserForm, setCreateUserForm] = useState({ username: '', password: '', role: 'read-only' })
  const [resetPasswordForm, setResetPasswordForm] = useState({ username: '', newPassword: '' })
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [userSearchQuery, setUserSearchQuery] = useState('')
  
  // App bundle modals
  const [showManifestModal, setShowManifestModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<string | null>(null)
  const [currentManifest, setCurrentManifest] = useState<AppBundleManifest | null>(null)
  const [bundleChanges, setBundleChanges] = useState<AppBundleChanges | null>(null)
  const [activeVersion, setActiveVersion] = useState<string | null>(null)

  const loadAppBundles = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get versions and manifest to determine active version
      const [versionsResponse, manifest] = await Promise.all([
        api.get<AppBundleVersionsResponse>('/app-bundle/versions'),
        api.getAppBundleManifest().catch(() => null), // Manifest might not exist if no bundle is active
      ])
      
      const activeVer = manifest?.version || null
      setActiveVersion(activeVer)
      
      const versions: AppBundleVersion[] = (versionsResponse.versions || []).map((v: string) => {
        // Remove asterisk suffix if present (CLI marks active version with *)
        const cleanVersion = v.replace(/\s*\*$/, '')
        return {
          version: cleanVersion,
          isActive: cleanVersion === activeVer,
        }
      })
      setAppBundles(versions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load app bundles')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchVersion = async (version: string) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.switchAppBundleVersion(version)
      setSuccess(`Successfully switched to version ${version}`)
      setShowSwitchConfirm(null)
      await loadAppBundles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch version')
    } finally {
      setLoading(false)
    }
  }

  const handleViewManifest = async () => {
    setLoading(true)
    setError(null)
    try {
      const manifest = await api.getAppBundleManifest()
      setCurrentManifest(manifest)
      setShowManifestModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manifest')
    } finally {
      setLoading(false)
    }
  }

  const handleViewChanges = async (targetVersion: string) => {
    setLoading(true)
    setError(null)
    try {
      const changes = await api.getAppBundleChanges(activeVersion || undefined, targetVersion)
      setBundleChanges(changes)
      setShowChangesModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changes')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadFile = async (filePath: string) => {
    setLoading(true)
    setError(null)
    try {
      const blob = await api.downloadAppBundleFile(filePath)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract filename from path
      const filename = filePath.split('/').pop() || filePath
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setSuccess(`File ${filename} downloaded successfully!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    if (user?.role !== 'admin') {
      setError('Admin access required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const userList = await api.listUsers()
      setUsers(Array.isArray(userList) ? userList : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadSystemInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const info = await api.get<SystemInfo>('/version')
      setSystemInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system info')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setError(null)
    setSuccess(null)
    
    if (tab === 'app-bundles' && appBundles.length === 0) {
      loadAppBundles()
    } else if (tab === 'users' && users.length === 0) {
      loadUsers()
    } else if (tab === 'system' && !systemInfo) {
      loadSystemInfo()
    }
  }

  const handleUploadClick = () => {
    if (loading) return
    // Use setTimeout to ensure the click happens after any state updates
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }, 0)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('bundle', file)

      const token = localStorage.getItem('token')
      
      // Use XMLHttpRequest for upload progress (don't set Content-Type - browser does it automatically with boundary)
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(percentComplete)
        }
      })

      const result = await new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } catch (e) {
              reject(new Error('Invalid response from server'))
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || errorData.error || `Upload failed: ${xhr.status}`))
            } catch (e) {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
            }
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error: Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')))

        const apiBaseUrl = getApiBaseUrl()
        const uploadUrl = `${apiBaseUrl}/app-bundle/push`
        xhr.open('POST', uploadUrl)
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        // Don't set Content-Type - browser sets it automatically with boundary for FormData
        xhr.send(formData)
      })
      setSuccess(`Bundle uploaded successfully! Version: ${result.manifest?.version || result.version || 'N/A'}`)
      setUploadProgress(100)
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      await loadAppBundles()
      
      setTimeout(() => {
        setUploadProgress(0)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload bundle')
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dataexport/parquet', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `synkronus-export-${new Date().toISOString().split('T')[0]}.parquet`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setSuccess('Data exported successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setLoading(false)
    }
  }

  // User management handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createUserForm.username || !createUserForm.password) {
      setError('Username and password are required')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createUser(createUserForm)
      setSuccess('User created successfully!')
      setCreateUserForm({ username: '', password: '', role: 'read-only' })
      setShowCreateUserModal(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (!username) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.deleteUser(username)
      setSuccess(`User ${username} deleted successfully!`)
      setShowDeleteConfirm(null)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordForm.username || !resetPasswordForm.newPassword) {
      setError('Username and new password are required')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.resetPassword(resetPasswordForm)
      setSuccess(`Password reset successfully for ${resetPasswordForm.username}!`)
      setResetPasswordForm({ username: '', newPassword: '' })
      setShowResetPasswordModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword) {
      setError('Current password and new password are required')
      return
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setError('New passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.changePassword({
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword,
      })
      setSuccess('Password changed successfully!')
      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowChangePasswordModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <img src={odeLogo} alt="ODE Logo" className="logo-icon" />
            <h1>Synkronus Portal</h1>
          </div>
        <div className="user-info">
            <div className="user-details">
              <span className="welcome-text">Welcome back,</span>
              <span className="username">{user?.username}</span>
            </div>
            <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
          <button onClick={logout} className="logout-button">
              <span>Logout</span>
          </button>
          </div>
        </div>
      </header>
      
      <main className="dashboard-content">
        <nav className="dashboard-tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => handleTabChange('overview')}
          >
            <span className="tab-icon">📊</span>
            <span>Overview</span>
          </button>
          <button
            className={activeTab === 'app-bundles' ? 'active' : ''}
            onClick={() => handleTabChange('app-bundles')}
          >
            <span className="tab-icon">📦</span>
            <span>App Bundles</span>
          </button>
          {user?.role === 'admin' && (
            <button
              className={activeTab === 'users' ? 'active' : ''}
              onClick={() => handleTabChange('users')}
            >
              <span className="tab-icon">👥</span>
              <span>Users</span>
            </button>
          )}
          <button
            className={activeTab === 'data-export' ? 'active' : ''}
            onClick={() => handleTabChange('data-export')}
          >
            <span className="tab-icon">📥</span>
            <span>Data Export</span>
          </button>
          <button
            className={activeTab === 'system' ? 'active' : ''}
            onClick={() => handleTabChange('system')}
          >
            <span className="tab-icon">⚙️</span>
            <span>System</span>
          </button>
        </nav>

        {error && (
          <div className="alert-banner error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="alert-close">×</button>
          </div>
        )}

        {success && (
          <div className="alert-banner success">
            <span className="alert-icon">✓</span>
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="alert-close">×</button>
          </div>
        )}

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-section">
              <div className="section-title">
                <h2>Dashboard Overview</h2>
                <p className="section-subtitle">Welcome to your Synkronus control center</p>
              </div>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon">✓</div>
                  <div className="stat-content">
                    <h3>System Status</h3>
                    <p className="stat-value">Operational</p>
                  </div>
                </div>
                <div className="stat-card info">
                  <div className="stat-icon">👤</div>
                  <div className="stat-content">
                    <h3>User Role</h3>
                    <p className="stat-value">{user?.role || 'N/A'}</p>
                  </div>
                </div>
                <div className="stat-card success">
                  <div className="stat-icon">🔐</div>
                  <div className="stat-content">
                    <h3>Username</h3>
                    <p className="stat-value">{user?.username || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="welcome-card">
                <div className="welcome-icon">🚀</div>
                <div>
                  <h3>Get Started</h3>
                  <p>Use the navigation tabs above to manage app bundles, users, export data, and view system information.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'app-bundles' && (
            <div className="app-bundles-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>App Bundles</h2>
                  <p className="section-subtitle">Manage your application bundles</p>
                </div>
                <div className="section-actions">
                  {user?.role === 'admin' && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="bundle-upload"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={loading}
                        className={`upload-button ${loading ? 'uploading' : ''}`}
                      >
                        {loading ? (
                          <>
                            <span className="button-spinner"></span>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <span>📤</span>
                            <span>Upload Bundle</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  <button onClick={loadAppBundles} disabled={loading} className="refresh-button">
                    <span>🔄</span>
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <span className="progress-text">{Math.round(uploadProgress)}%</span>
                </div>
              )}

              {loading && appBundles.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading app bundles...</p>
                </div>
              ) : appBundles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h3>No App Bundles</h3>
                  <p>Upload your first app bundle to get started</p>
                </div>
              ) : (
                <div className="bundles-grid">
                  {appBundles.map((bundle) => (
                    <div key={bundle.version} className="bundle-card">
                      <div className="bundle-header">
                        <div className="bundle-icon">📦</div>
                        <div className="bundle-info">
                          <h3>Version {bundle.version}</h3>
                          <span className={`bundle-status ${bundle.isActive ? 'active' : 'inactive'}`}>
                            {bundle.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </div>
                      </div>
                      {bundle.createdAt && (
                        <div className="bundle-meta">
                          <span>Created: {new Date(bundle.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="bundle-actions">
                        {user?.role === 'admin' && !bundle.isActive && (
                          <button
                            onClick={() => setShowSwitchConfirm(bundle.version)}
                            className="bundle-action-btn activate-btn"
                            title="Activate this version"
                          >
                            <span>🔄</span>
                            <span>Activate</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleViewChanges(bundle.version)}
                          className="bundle-action-btn changes-btn"
                          title="View changes from current version"
                          disabled={bundle.isActive || !activeVersion}
                        >
                          <span>📊</span>
                          <span>Changes</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* View Manifest Button */}
              {activeVersion && (
                <div className="manifest-section">
                  <button onClick={handleViewManifest} className="view-manifest-btn">
                    <span>📄</span>
                    <span>View Current Manifest</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && user?.role === 'admin' && (
            <div className="users-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>User Management</h2>
                  <p className="section-subtitle">Manage system users and permissions</p>
                </div>
                <div className="section-actions">
                  <button onClick={() => setShowCreateUserModal(true)} disabled={loading} className="create-button">
                    <span>➕</span>
                    <span>Create User</span>
                  </button>
                  <button onClick={loadUsers} disabled={loading} className="refresh-button">
                    <span>🔄</span>
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="users-search-container">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search users by username or role..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="search-clear"
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Users Table */}
              {loading && users.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th className="actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => {
                          if (!userSearchQuery) return true
                          const query = userSearchQuery.toLowerCase()
                          return (
                            u.username.toLowerCase().includes(query) ||
                            u.role.toLowerCase().includes(query)
                          )
                        })
                        .map((u) => (
                          <tr key={u.username}>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar-small">{u.username.charAt(0).toUpperCase()}</div>
                                <span className="user-name">{u.username}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`role-badge role-${u.role}`}>{u.role}</span>
                            </td>
                            <td>
                              <span className="created-date">
                                {u.createdAt
                                  ? new Date(u.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  onClick={() => {
                                    setResetPasswordForm({ username: u.username, newPassword: '' })
                                    setShowResetPasswordModal(true)
                                  }}
                                  className="table-action-btn reset-password-btn"
                                  title="Reset Password"
                                >
                                  <span>🔑</span>
                                  <span>Reset Password</span>
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(u.username)}
                                  className="table-action-btn delete-btn"
                                  title="Delete User"
                                >
                                  <span>🗑️</span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {users.filter((u) => {
                    if (!userSearchQuery) return true
                    const query = userSearchQuery.toLowerCase()
                    return (
                      u.username.toLowerCase().includes(query) ||
                      u.role.toLowerCase().includes(query)
                    )
                  }).length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <h3>{userSearchQuery ? 'No users found' : 'No Users Found'}</h3>
                      <p>
                        {userSearchQuery
                          ? 'Try adjusting your search query'
                          : 'Create your first user to get started'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && user?.role !== 'admin' && (
            <div className="users-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>My Account</h2>
                  <p className="section-subtitle">Manage your account settings</p>
                </div>
                <button onClick={() => setShowChangePasswordModal(true)} className="change-password-button">
                  <span>🔑</span>
                  <span>Change Password</span>
                </button>
              </div>
              <div className="user-info-card">
                <div className="user-avatar-large">{user?.username.charAt(0).toUpperCase()}</div>
                <div className="user-info">
                  <h3>{user?.username}</h3>
                  <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data-export' && (
            <div className="data-export-section">
              <div className="section-title">
                <h2>Data Export</h2>
                <p className="section-subtitle">Export observation data for analysis</p>
              </div>
              <div className="export-card">
                <div className="export-icon">📊</div>
                <div className="export-content">
                  <h3>Export to Parquet</h3>
                  <p>Download all observation data in Parquet format for analysis in Python, R, or other data science tools.</p>
                  <button
                    onClick={handleExportData}
                    disabled={loading}
                    className="export-button"
                  >
                    {loading ? (
                      <>
                        <span className="button-spinner"></span>
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <span>📥</span>
                        <span>Export Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="system-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>System Information</h2>
                  <p className="section-subtitle">Server version and build details</p>
                </div>
                <button onClick={loadSystemInfo} disabled={loading} className="refresh-button">
                  <span>🔄</span>
                  <span>Refresh</span>
                </button>
              </div>
              {loading && !systemInfo ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading system information...</p>
                </div>
              ) : systemInfo ? (
                <div className="info-cards">
                  <div className="info-card">
                    <div className="info-icon">🔢</div>
                    <div className="info-content">
                      <h3>Version</h3>
                      <p>{systemInfo.server?.version || systemInfo.version || 'N/A'}</p>
                    </div>
                  </div>
                  {systemInfo.build?.build_time && (
                    <div className="info-card">
                      <div className="info-icon">🕒</div>
                      <div className="info-content">
                        <h3>Build Time</h3>
                        <p>{new Date(systemInfo.build.build_time).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {systemInfo.build?.commit && (
                    <div className="info-card">
                      <div className="info-icon">🔗</div>
                      <div className="info-content">
                        <h3>Git Commit</h3>
                        <p className="commit-hash">{systemInfo.build.commit}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">⚙️</div>
                  <h3>No System Info</h3>
                  <p>Click refresh to load system information</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New User</h2>
              <button className="modal-close" onClick={() => setShowCreateUserModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={createUserForm.username}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}
                  required
                  disabled={loading}
                >
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read Write</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateUserModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={() => setShowResetPasswordModal(false)}>×</button>
            </div>
            <form onSubmit={handleResetPassword} className="modal-form">
              <div className="form-group">
                <label htmlFor="reset-username">Username</label>
                <input
                  type="text"
                  id="reset-username"
                  value={resetPasswordForm.username}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, username: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  type="password"
                  id="new-password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowResetPasswordModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={() => setShowChangePasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => setShowChangePasswordModal(false)}>×</button>
            </div>
            <form onSubmit={handleChangePassword} className="modal-form">
              <div className="form-group">
                <label htmlFor="current-password">Current Password</label>
                <input
                  type="password"
                  id="current-password"
                  value={changePasswordForm.currentPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-password-change">New Password</label>
                <input
                  type="password"
                  id="new-password-change"
                  value={changePasswordForm.newPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input
                  type="password"
                  id="confirm-password"
                  value={changePasswordForm.confirmPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowChangePasswordModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete user <strong>{showDeleteConfirm}</strong>? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} disabled={loading}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                disabled={loading}
                className="delete-confirm-btn"
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Version Confirmation Modal */}
      {showSwitchConfirm && (
        <div className="modal-overlay" onClick={() => setShowSwitchConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Activate Bundle Version</h2>
              <button className="modal-close" onClick={() => setShowSwitchConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to activate version <strong>{showSwitchConfirm}</strong>? This will switch the active app bundle to this version.</p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowSwitchConfirm(null)} disabled={loading}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSwitchVersion(showSwitchConfirm)}
                disabled={loading}
                className="activate-confirm-btn"
              >
                {loading ? 'Activating...' : 'Activate Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manifest Modal */}
      {showManifestModal && currentManifest && (
        <div className="modal-overlay" onClick={() => setShowManifestModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>App Bundle Manifest</h2>
              <button className="modal-close" onClick={() => setShowManifestModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="manifest-info">
                <div className="info-row">
                  <strong>Version:</strong> <span>{currentManifest.version}</span>
                </div>
                <div className="info-row">
                  <strong>Hash:</strong> <span className="hash-value">{currentManifest.hash}</span>
                </div>
                <div className="info-row">
                  <strong>Files:</strong> <span>{currentManifest.files.length}</span>
                </div>
              </div>
              <div className="files-list">
                <h3>Files</h3>
                <div className="files-table-container">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Size</th>
                        <th>Hash</th>
                        <th className="actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentManifest.files.map((file, idx) => (
                        <tr key={idx}>
                          <td className="file-path">{file.path}</td>
                          <td>{file.size} bytes</td>
                          <td className="hash-value">{file.hash}</td>
                          <td>
                            <button
                              onClick={() => handleDownloadFile(file.path)}
                              className="file-download-btn"
                              title="Download file"
                              disabled={loading}
                            >
                              <span>⬇️</span>
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowManifestModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Changes Modal */}
      {showChangesModal && bundleChanges && (
        <div className="modal-overlay" onClick={() => setShowChangesModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Version Changes</h2>
              <button className="modal-close" onClick={() => setShowChangesModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="changes-info">
                {bundleChanges.compare_version_a && bundleChanges.compare_version_b && (
                  <div className="info-row">
                    <strong>Comparing:</strong> <span>{bundleChanges.compare_version_a} → {bundleChanges.compare_version_b}</span>
                  </div>
                )}
              </div>
              {bundleChanges.added && bundleChanges.added.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-added">➕ Added ({bundleChanges.added.length})</h3>
                  <ul className="changes-list">
                    {bundleChanges.added.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bundleChanges.removed && bundleChanges.removed.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-removed">➖ Removed ({bundleChanges.removed.length})</h3>
                  <ul className="changes-list">
                    {bundleChanges.removed.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bundleChanges.modified && bundleChanges.modified.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-modified">✏️ Modified ({bundleChanges.modified.length})</h3>
                  <ul className="changes-list">
                    {bundleChanges.modified.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(!bundleChanges.added || bundleChanges.added.length === 0) &&
               (!bundleChanges.removed || bundleChanges.removed.length === 0) &&
               (!bundleChanges.modified || bundleChanges.modified.length === 0) && (
                <p className="no-changes">No changes detected between versions.</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowChangesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
