import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { Button, Input, Badge } from "@ode/components/react-web";

import { 
  HiOutlineChartBar, HiChartBar,
  HiOutlineCube, HiCube,
  HiOutlineUsers, HiUsers,
  HiOutlineClipboardDocumentList, HiClipboardDocumentList,
  HiOutlineArrowDownTray, HiArrowDownTray,
  HiOutlineCog6Tooth, HiCog6Tooth,
  HiCheckCircle,
  HiUser,
  HiLockClosed,
  HiRocketLaunch,
  HiExclamationTriangle,
  HiArrowUpTray,
  HiArrowPath,
  HiMagnifyingGlass,
  HiKey,
  HiTrash,
  HiEye,
  HiServer,
  HiGlobeAlt,
  HiClock,
  HiHashtag,
  HiComputerDesktop,
  HiCalendar,
  HiLink,
  HiPlus,
  HiXMark,
  HiHeart,
  HiDocumentText
} from 'react-icons/hi2'
import odeLogo from '../assets/ode_logo.png'
import dashboardBackground from '../assets/dashboard-background.png'
import './Dashboard.css'

type TabType = 'overview' | 'app-bundles' | 'users' | 'observations' | 'data-export' | 'system'

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
    go_version?: string
  }
  version?: string
  database?: {
    type?: string
    version?: string
    database_name?: string
  }
  system?: {
    os?: string
    architecture?: string
    cpus?: number
  }
}

interface HealthStatus {
  status: string
  timestamp?: string
  database?: {
    status: string
    response_time?: number
  }
  api?: {
    status: string
    uptime?: number
  }
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [appBundles, setAppBundles] = useState<AppBundleVersion[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
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
  
  // Clear form when modal opens/closes
  const handleOpenCreateUserModal = () => {
    setCreateUserForm({ username: '', password: '', role: 'read-only' })
    setShowCreateUserModal(true)
  }
  
  const handleCloseCreateUserModal = () => {
    setCreateUserForm({ username: '', password: '', role: 'read-only' })
    setShowCreateUserModal(false)
  }
  const [resetPasswordForm, setResetPasswordForm] = useState({ username: '', newPassword: '' })
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [userSearchQuery, setUserSearchQuery] = useState('')
  
  // Observations state
  const [observations, setObservations] = useState<any[]>([])
  const [observationSearchQuery, setObservationSearchQuery] = useState('')
  const [showObservationModal, setShowObservationModal] = useState(false)
  const [selectedObservation, setSelectedObservation] = useState<any | null>(null)
  
  // App bundle modals
  const [autoActivate, setAutoActivate] = useState(false)
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
      const [info, healthResponse] = await Promise.all([
        api.get<SystemInfo>('/version').catch(() => null),
        fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`).catch(() => null)
      ])
      if (info) setSystemInfo(info)
      
      // Health endpoint returns plain text "OK", so we create a health status object
      if (healthResponse && healthResponse.ok) {
        const healthText = await healthResponse.text()
        setHealthStatus({
          status: healthText || 'OK',
          timestamp: new Date().toISOString()
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system info')
    } finally {
      setLoading(false)
    }
  }

  const handleViewObservation = (observation: any) => {
    setSelectedObservation(observation)
    setShowObservationModal(true)
  }

  const loadObservations = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use sync/pull to get all observations
      // Generate a temporary client_id for the portal
      const clientId = `portal-${Date.now()}`
      const response = await api.post<any>('/sync/pull', {
        client_id: clientId,
        since: { version: 0 },
        limit: 1000
      })
      setObservations(response.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load observations')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setError(null)
    setSuccess(null)
    
    if (tab === 'app-bundles') {
      // Always refresh app bundles to get latest activated version
      loadAppBundles()
    } else if (tab === 'users' && users.length === 0) {
      loadUsers()
    } else if (tab === 'observations' && observations.length === 0) {
      loadObservations()
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

        const apiBaseUrl = import.meta.env.VITE_API_URL || '/api'
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
      
      // Auto-activate if enabled
      if (autoActivate && result.manifest?.version) {
        try {
          await api.switchAppBundleVersion(result.manifest.version)
          setSuccess(`Bundle uploaded and activated! Version: ${result.manifest.version}`)
          await loadAppBundles()
        } catch (err) {
          setError(`Bundle uploaded but failed to activate: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      
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
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('token')
      
      const response = await fetch(`${apiBaseUrl}/dataexport/parquet`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      })

      if (!response.ok) {
        let errorMessage = `Failed to export data (${response.status})`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Get the filename from Content-Disposition header, or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `observations_export_${new Date().toISOString().split('T')[0]}.zip`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
          // Ensure it has .zip extension
          if (!filename.endsWith('.zip')) {
            filename = filename.replace(/\.parquet$/, '') + '.zip'
          }
        }
      }

      const blob = await response.blob()
      
      // Verify it's actually a ZIP file (backend returns application/zip)
      if (blob.size === 0) {
        throw new Error('Export file is empty')
      }

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)
      
      setSuccess(`Data exported successfully! Downloaded ${filename}`)
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
      // Clear form immediately
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
      // Clear form immediately
      setResetPasswordForm({ username: '', newPassword: '' })
      setShowResetPasswordModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCloseResetPasswordModal = () => {
    setResetPasswordForm({ username: '', newPassword: '' })
    setShowResetPasswordModal(false)
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
      // Clear form immediately
      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowChangePasswordModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCloseChangePasswordModal = () => {
    setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setShowChangePasswordModal(false)
  }
  
  const handleOpenChangePasswordModal = () => {
    setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setShowChangePasswordModal(true)
  }

  return (
    <div className="dashboard" style={{ '--dashboard-bg-image': `url(${dashboardBackground})` } as React.CSSProperties}>
      <div className="gold-circle-1"></div>
      <div className="gold-circle-2"></div>
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
            <Badge variant={user?.role === 'admin' ? 'primary' : 'neutral'}>{user?.role}</Badge>
          <Button variant="neutral" onPress={logout} className="logout-button">
              Logout
          </Button>
          </div>
        </div>
      </header>
      
      <main className="dashboard-content">
        <nav className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''} fade-left`}
            onClick={() => handleTabChange('overview')}
          >
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient id="border-fade-left-0" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4f7f4e" stopOpacity="0" />
                  <stop offset="15%" stopColor="#4f7f4e" stopOpacity="1" />
                  <stop offset="100%" stopColor="#4f7f4e" stopOpacity="1" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" rx="8" stroke="url(#border-fade-left-0)" />
            </svg>
            <span className="tab-icon">
              {activeTab === 'overview' ? <HiChartBar /> : <HiOutlineChartBar />}
            </span>
            <span>Overview</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'app-bundles' ? 'active' : ''} fade-right`}
            onClick={() => handleTabChange('app-bundles')}
          >
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient id="border-fade-right-0" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4f7f4e" stopOpacity="1" />
                  <stop offset="85%" stopColor="#4f7f4e" stopOpacity="1" />
                  <stop offset="100%" stopColor="#4f7f4e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" rx="8" stroke="url(#border-fade-right-0)" />
            </svg>
            <span className="tab-icon">
              {activeTab === 'app-bundles' ? <HiCube /> : <HiOutlineCube />}
            </span>
            <span>App Bundles</span>
          </button>
          {user?.role === 'admin' && (
            <button
              className={`tab-button ${activeTab === 'users' ? 'active' : ''} fade-left`}
              onClick={() => handleTabChange('users')}
            >
              <svg className="border-fade" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="border-fade-left-1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f7f4e" stopOpacity="0" />
                    <stop offset="15%" stopColor="#4f7f4e" stopOpacity="1" />
                    <stop offset="100%" stopColor="#4f7f4e" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" rx="8" stroke="url(#border-fade-left-1)" />
              </svg>
              <span className="tab-icon">
                {activeTab === 'users' ? <HiUsers /> : <HiOutlineUsers />}
              </span>
              <span>Users</span>
            </button>
          )}
          <button
            className={`tab-button ${activeTab === 'observations' ? 'active' : ''} ${user?.role === 'admin' ? 'fade-right' : 'fade-left'}`}
            onClick={() => handleTabChange('observations')}
          >
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`border-fade-obs-${user?.role === 'admin' ? 'right' : 'left'}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  {user?.role === 'admin' ? (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="85%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="0" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="0" />
                      <stop offset="15%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="1" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" rx="8" stroke={`url(#border-fade-obs-${user?.role === 'admin' ? 'right' : 'left'})`} />
            </svg>
            <span className="tab-icon">
              {activeTab === 'observations' ? <HiClipboardDocumentList /> : <HiOutlineClipboardDocumentList />}
            </span>
            <span>Observations</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'data-export' ? 'active' : ''} ${user?.role === 'admin' ? 'fade-left' : 'fade-right'}`}
            onClick={() => handleTabChange('data-export')}
          >
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`border-fade-export-${user?.role === 'admin' ? 'left' : 'right'}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  {user?.role === 'admin' ? (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="0" />
                      <stop offset="15%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="1" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="85%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="0" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" rx="8" stroke={`url(#border-fade-export-${user?.role === 'admin' ? 'left' : 'right'})`} />
            </svg>
            <span className="tab-icon">
              {activeTab === 'data-export' ? <HiArrowDownTray /> : <HiOutlineArrowDownTray />}
            </span>
            <span>Data Export</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'system' ? 'active' : ''} ${user?.role === 'admin' ? 'fade-right' : 'fade-left'}`}
            onClick={() => handleTabChange('system')}
          >
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`border-fade-system-${user?.role === 'admin' ? 'right' : 'left'}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  {user?.role === 'admin' ? (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="85%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="0" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#4f7f4e" stopOpacity="0" />
                      <stop offset="15%" stopColor="#4f7f4e" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4f7f4e" stopOpacity="1" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" rx="8" stroke={`url(#border-fade-system-${user?.role === 'admin' ? 'right' : 'left'})`} />
            </svg>
            <span className="tab-icon">
              {activeTab === 'system' ? <HiCog6Tooth /> : <HiOutlineCog6Tooth />}
            </span>
            <span>System</span>
          </button>
        </nav>

        {error && (
          <div className="alert-banner error">
            <span className="alert-icon"><HiExclamationTriangle /></span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="alert-close"><HiXMark /></button>
          </div>
        )}

        {success && (
          <div className="alert-banner success">
            <span className="alert-icon"><HiCheckCircle /></span>
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="alert-close"><HiXMark /></button>
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
                  <div className="stat-icon">
                    <HiCheckCircle />
                  </div>
                  <div className="stat-content">
                    <h3>System Status</h3>
                    <p className="stat-value">Operational</p>
                  </div>
                </div>
                <div className="stat-card info">
                  <div className="stat-icon">
                    <HiUser />
                  </div>
                  <div className="stat-content">
                    <h3>User Role</h3>
                    <p className="stat-value">{user?.role || 'N/A'}</p>
                  </div>
                </div>
                <div className="stat-card success">
                  <div className="stat-icon">
                    <HiLockClosed />
                  </div>
                  <div className="stat-content">
                    <h3>Username</h3>
                    <p className="stat-value">{user?.username || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="welcome-card">
                <div className="welcome-icon">
                  <HiRocketLaunch />
                </div>
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
                      <Button
                        variant="primary"
                        onPress={handleUploadClick}
                        disabled={loading}
                        loading={loading}
                        className="upload-button"
                      >
                        <HiArrowUpTray /> Upload Bundle
                      </Button>
                      <label className="auto-activate-toggle">
                        <input
                          type="checkbox"
                          checked={autoActivate}
                          onChange={(e) => setAutoActivate(e.target.checked)}
                          disabled={loading}
                        />
                        <span>Auto-activate</span>
                      </label>
                    </>
                  )}
                  <Button variant="neutral" onPress={loadAppBundles} disabled={loading} className="refresh-button">
                    <HiArrowPath /> Refresh
                  </Button>
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
                  <div className="empty-icon"><HiCube /></div>
                  <h3>No App Bundles</h3>
                  <p>Upload your first app bundle to get started</p>
                </div>
              ) : (
                <div className="bundles-grid">
                  {appBundles.map((bundle) => (
                    <div key={bundle.version} className="bundle-card">
                      <div className="bundle-header">
                        <div className="bundle-icon"><HiCube /></div>
                        <div className="bundle-info">
                          <h3>Version {bundle.version}</h3>
                          <Badge variant={bundle.isActive ? 'success' : 'neutral'}>
                            {bundle.isActive ? '● Active' : '○ Inactive'}
                          </Badge>
                        </div>
                      </div>
                      {bundle.createdAt && (
                        <div className="bundle-meta">
                          <span>Created: {new Date(bundle.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="bundle-actions">
                        {user?.role === 'admin' && !bundle.isActive && (
                          <Button
                            variant="primary"
                            onPress={() => setShowSwitchConfirm(bundle.version)}
                            className="bundle-action-btn activate-btn"
                            accessibilityLabel="Activate this version"
                          >
                            <HiArrowPath /> Activate
                          </Button>
                        )}
                        <Button
                          variant="neutral"
                          onPress={() => handleViewChanges(bundle.version)}
                          className="bundle-action-btn changes-btn"
                          accessibilityLabel="View changes from current version"
                          disabled={bundle.isActive || !activeVersion}
                        >
                          <HiChartBar /> Changes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* View Manifest Button */}
              {activeVersion && (
                <div className="manifest-section">
                  <Button variant="neutral" onPress={handleViewManifest} className="view-manifest-btn">
                    <HiDocumentText /> View Current Manifest
                  </Button>
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
                  <Button variant="primary" onPress={handleOpenCreateUserModal} disabled={loading} className="create-button">
                    <HiPlus /> Create User
                  </Button>
                  <Button variant="neutral" onPress={loadUsers} disabled={loading} className="refresh-button">
                    <HiArrowPath /> Refresh
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="users-search-container">
                <div className="search-input-wrapper">
                  <Input
                    type="text"
                    placeholder="Search users by username or role..."
                    value={userSearchQuery}
                    onChangeText={setUserSearchQuery}
                    className="search-input"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="search-clear"
                      title="Clear search"
                    >
                      <HiXMark />
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
                              <Badge variant={u.role === 'admin' ? 'primary' : u.role === 'read-write' ? 'secondary' : 'neutral'}>{u.role}</Badge>
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
                                <Button
                                  variant="neutral"
                                  onPress={() => {
                                    setResetPasswordForm({ username: u.username, newPassword: '' })
                                    setShowResetPasswordModal(true)
                                  }}
                                  className="table-action-btn reset-password-btn"
                                  accessibilityLabel="Reset Password"
                                >
                                  <HiKey /> Reset Password
                                </Button>
                                <Button
                                  variant="neutral"
                                  onPress={() => setShowDeleteConfirm(u.username)}
                                  className="table-action-btn delete-btn"
                                  accessibilityLabel="Delete User"
                                >
                                  <HiTrash /> Delete
                                </Button>
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
                      <div className="empty-icon"><HiUsers /></div>
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
                <Button variant="primary" onPress={handleOpenChangePasswordModal} className="change-password-button">
                  <HiKey /> Change Password
                </Button>
              </div>
              <div className="user-info-card">
                <div className="user-avatar-large">{user?.username.charAt(0).toUpperCase()}</div>
                <div className="user-info">
                  <h3>{user?.username}</h3>
                  <Badge variant={user?.role === 'admin' ? 'primary' : user?.role === 'read-write' ? 'secondary' : 'neutral'}>{user?.role}</Badge>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'observations' && (
            <div className="observations-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>Observations</h2>
                  <p className="section-subtitle">View and search all observations</p>
                </div>
                <Button variant="neutral" onPress={loadObservations} disabled={loading} className="refresh-button">
                  <HiArrowPath /> Refresh
                </Button>
              </div>

              {loading && observations.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading observations...</p>
                </div>
              ) : (
                <div className="observations-table-container">
                  <div className="search-bar">
                    <Input
                      type="text"
                      placeholder="Search by Observation ID, Form Type, Form Version, or Version..."
                      value={observationSearchQuery}
                      onChangeText={setObservationSearchQuery}
                      className="search-input"
                    />
                    {observationSearchQuery && (
                      <Button
                        variant="neutral"
                        onPress={() => setObservationSearchQuery('')}
                        className="clear-search-button"
                        accessibilityLabel="Clear search"
                      >
                        <HiXMark />
                      </Button>
                    )}
                  </div>

                  {observations.filter((obs) => {
                    if (!observationSearchQuery) return true
                    const query = observationSearchQuery.toLowerCase()
                    return (
                      obs.observation_id?.toLowerCase().includes(query) ||
                      obs.form_type?.toLowerCase().includes(query) ||
                      obs.form_version?.toLowerCase().includes(query) ||
                      obs.version?.toString().includes(query)
                    )
                  }).length > 0 && (
                    <div className="observations-count">
                      Showing {observations.filter((obs) => {
                        if (!observationSearchQuery) return true
                        const query = observationSearchQuery.toLowerCase()
                        return (
                          obs.observation_id?.toLowerCase().includes(query) ||
                          obs.form_type?.toLowerCase().includes(query) ||
                          obs.form_version?.toLowerCase().includes(query) ||
                          obs.version?.toString().includes(query)
                        )
                      }).length} of {observations.length} observations
                    </div>
                  )}

                  <div className="table-container">
                    <table className="observations-table">
                      <thead>
                        <tr>
                          <th>Observation ID</th>
                          <th>Form Type</th>
                          <th>Form Version</th>
                          <th>Created At</th>
                          <th>Updated At</th>
                          <th>Synced At</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th className="actions-column">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {observations.filter((obs) => {
                          if (!observationSearchQuery) return true
                          const query = observationSearchQuery.toLowerCase()
                          return (
                            obs.observation_id?.toLowerCase().includes(query) ||
                            obs.form_type?.toLowerCase().includes(query) ||
                            obs.form_version?.toLowerCase().includes(query) ||
                            obs.version?.toString().includes(query)
                          )
                        }).map((obs) => (
                          <tr key={obs.observation_id} className={obs.deleted ? 'deleted' : ''}>
                            <td>
                              <code className="observation-id-code" title={obs.observation_id}>
                                {obs.observation_id}
                              </code>
                            </td>
                            <td style={{ color: 'var(--color-neutral-200)' }}>{obs.form_type}</td>
                            <td style={{ color: 'var(--color-neutral-200)' }}>{obs.form_version}</td>
                            <td style={{ color: 'var(--color-neutral-300)', fontSize: '13px' }}>{new Date(obs.created_at).toLocaleString()}</td>
                            <td style={{ color: 'var(--color-neutral-300)', fontSize: '13px' }}>{new Date(obs.updated_at).toLocaleString()}</td>
                            <td style={{ color: 'var(--color-neutral-300)', fontSize: '13px' }}>{obs.synced_at ? new Date(obs.synced_at).toLocaleString() : '—'}</td>
                            <td style={{ color: 'var(--color-neutral-200)', fontFamily: 'monospace' }}>{obs.version}</td>
                            <td>
                              {obs.deleted ? (
                                <Badge variant="error">Deleted</Badge>
                              ) : (
                                <Badge variant="success">Active</Badge>
                              )}
                            </td>
                            <td>
                              <div className="table-actions">
                                <Button
                                  variant="neutral"
                                  onPress={() => handleViewObservation(obs)}
                                  className="table-action-btn view-btn"
                                  accessibilityLabel="View Details"
                                >
                                  <HiEye /> View
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {observations.filter((obs) => {
                    if (!observationSearchQuery) return true
                    const query = observationSearchQuery.toLowerCase()
                    return (
                      obs.observation_id?.toLowerCase().includes(query) ||
                      obs.form_type?.toLowerCase().includes(query) ||
                      obs.form_version?.toLowerCase().includes(query) ||
                      obs.version?.toString().includes(query)
                    )
                  }).length === 0 && observationSearchQuery && (
                    <div className="observation-search-empty">
                      <div className="observation-search-empty-icon"><HiMagnifyingGlass /></div>
                      <h3>No observations found</h3>
                      <p>
                        No observations match your search query: "<strong>{observationSearchQuery}</strong>"
                      </p>
                      <button
                        onClick={() => setObservationSearchQuery('')}
                        className="clear-search-btn"
                      >
                        Clear Search
                      </button>
                    </div>
                  )}
                  {observations.length === 0 && !loading && !observationSearchQuery && (
                    <div className="empty-state">
                      <div className="empty-icon"><HiClipboardDocumentList /></div>
                      <p>No observations found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'data-export' && (
            <div className="data-export-section">
              <div className="section-title">
                <h2>Data Export</h2>
                <p className="section-subtitle">Export observation data for analysis</p>
              </div>
              <div className="export-card">
                <div className="export-icon"><HiChartBar /></div>
                <div className="export-content">
                  <h3>Export to Parquet</h3>
                  <p>Download all observation data as a ZIP archive containing Parquet files (one per form type) for analysis in Python, R, or other data science tools.</p>
                  <p className="additional-info">
                    The ZIP file contains separate Parquet files for each form type, making it easy to analyze observations by form.
                  </p>
                  <Button
                    variant="primary"
                    onPress={handleExportData}
                    disabled={loading}
                    loading={loading}
                    className="export-button"
                  >
                    <HiArrowDownTray /> Export Data
                  </Button>
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
                <Button variant="neutral" onPress={loadSystemInfo} disabled={loading} className="refresh-button">
                  <HiArrowPath /> Refresh
                </Button>
              </div>
              {loading && !systemInfo ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading system information...</p>
                </div>
              ) : systemInfo || healthStatus ? (
                <div>
                  {healthStatus && (
                    <div className="health-status-section">
                      <h3 className="health-status-title">Health Status</h3>
                      <div className="info-cards">
                        <div className="info-card">
                          <div className="info-icon"><HiHeart /></div>
                          <div className="info-content">
                            <h3>Overall Status</h3>
                            <p className={healthStatus.status === 'OK' || healthStatus.status === 'ok' ? 'health-status-text' : 'health-status-text error'}>
                              {healthStatus.status || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        {healthStatus.database && (
                          <div className="info-card">
                            <div className="info-icon"><HiServer /></div>
                            <div className="info-content">
                              <h3>Database</h3>
                              <p className={healthStatus.database.status === 'OK' || healthStatus.database.status === 'ok' ? 'health-status-text' : 'health-status-text error'}>
                                {healthStatus.database.status || 'Unknown'}
                                {healthStatus.database.response_time && ` (${healthStatus.database.response_time}ms)`}
                              </p>
                            </div>
                          </div>
                        )}
                        {healthStatus.api && (
                          <div className="info-card">
                            <div className="info-icon"><HiGlobeAlt /></div>
                            <div className="info-content">
                              <h3>API</h3>
                              <p className={healthStatus.api.status === 'OK' || healthStatus.api.status === 'ok' ? 'health-status-text' : 'health-status-text error'}>
                                {healthStatus.api.status || 'Unknown'}
                                {healthStatus.api.uptime && ` (${Math.floor(healthStatus.api.uptime / 3600)}h)`}
                              </p>
                            </div>
                          </div>
                        )}
                        {healthStatus.timestamp && (
                          <div className="info-card">
                            <div className="info-icon"><HiClock /></div>
                            <div className="info-content">
                              <h3>Last Check</h3>
                              <p>{new Date(healthStatus.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="system-info-title">System Information</h3>
                    <div className="info-cards">
                      <div className="info-card">
                        <div className="info-icon"><HiHashtag /></div>
                        <div className="info-content">
                          <h3>Server Version</h3>
                          <p>{systemInfo?.server?.version || systemInfo?.version || 'N/A'}</p>
                        </div>
                      </div>
                      {systemInfo?.build?.go_version && (
                        <div className="info-card">
                          <div className="info-icon"><HiCog6Tooth /></div>
                          <div className="info-content">
                            <h3>Go Runtime</h3>
                            <p>{systemInfo.build.go_version}</p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.system && (
                        <div className="info-card">
                          <div className="info-icon"><HiComputerDesktop /></div>
                          <div className="info-content">
                            <h3>System</h3>
                            <p className="system-info-text">
                              {systemInfo.system.os || 'N/A'} {systemInfo.system.architecture || ''}
                              {systemInfo.system.cpus && ` • ${systemInfo.system.cpus} CPUs`}
                            </p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.database?.database_name && (
                        <div className="info-card">
                          <div className="info-icon"><HiChartBar /></div>
                          <div className="info-content">
                            <h3>Database Name</h3>
                            <p>{systemInfo.database.database_name}</p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.database?.type && (
                        <div className="info-card">
                          <div className="info-icon"><HiServer /></div>
                          <div className="info-content">
                            <h3>Database Type</h3>
                            <p>{systemInfo.database.type}</p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.database?.version && (
                        <div className="info-card">
                          <div className="info-icon"><HiServer /></div>
                          <div className="info-content">
                            <h3>Database Version</h3>
                            <p className="system-info-text">{systemInfo.database.version}</p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.build?.build_time && (
                        <div className="info-card">
                          <div className="info-icon"><HiClock /></div>
                          <div className="info-content">
                            <h3>Build Time</h3>
                            <p>{new Date(systemInfo.build.build_time).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                      {systemInfo?.build?.commit && (
                        <div className="info-card">
                          <div className="info-icon"><HiLink /></div>
                          <div className="info-content">
                            <h3>Git Commit</h3>
                            <p className="commit-hash">{systemInfo.build.commit}</p>
                          </div>
                        </div>
                      )}
                      <div className="info-card">
                        <div className="info-icon"><HiGlobeAlt /></div>
                        <div className="info-content">
                            <h3>API Endpoint</h3>
                          <p className="api-endpoint-text">
                            {import.meta.env.VITE_API_URL || '/api'}
                          </p>
                        </div>
                      </div>
                      <div className="info-card">
                        <div className="info-icon"><HiCalendar /></div>
                        <div className="info-content">
                          <h3>Current Time</h3>
                          <p>{new Date().toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><HiCog6Tooth /></div>
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
        <div className="modal-overlay" onClick={handleCloseCreateUserModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New User</h2>
              <button className="modal-close" onClick={handleCloseCreateUserModal}>×</button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-form" autoComplete="off">
              <div className="form-group">
                <Input
                  label="Username"
                  type="text"
                  value={createUserForm.username}
                  onChangeText={(text: string) => setCreateUserForm({ ...createUserForm, username: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <Input
                  label="Password"
                  type="password"
                  value={createUserForm.password}
                  onChangeText={(text: string) => setCreateUserForm({ ...createUserForm, password: text })}
                  required
                  disabled={loading}
                  className="modal-input"
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
                <Button variant="neutral" onPress={handleCloseCreateUserModal} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={() => handleCreateUser({ preventDefault: () => {} } as React.FormEvent)} disabled={loading} loading={loading}>
                  Create User
                </Button>
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
            <form onSubmit={handleResetPassword} className="modal-form" autoComplete="off">
              <div className="form-group">
                <Input
                  label="Username"
                  type="text"
                  value={resetPasswordForm.username}
                  onChangeText={(text: string) => setResetPasswordForm({ ...resetPasswordForm, username: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <Input
                  label="New Password"
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChangeText={(text: string) => setResetPasswordForm({ ...resetPasswordForm, newPassword: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="modal-actions">
                <Button variant="neutral" onPress={handleCloseResetPasswordModal} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={() => handleResetPassword({ preventDefault: () => {} } as React.FormEvent)} disabled={loading} loading={loading}>
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={handleCloseChangePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={handleCloseChangePasswordModal}>×</button>
            </div>
            <form onSubmit={handleChangePassword} className="modal-form" autoComplete="off">
              <div className="form-group">
                <Input
                  label="Current Password"
                  type="password"
                  value={changePasswordForm.currentPassword}
                  onChangeText={(text: string) => setChangePasswordForm({ ...changePasswordForm, currentPassword: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <Input
                  label="New Password"
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChangeText={(text: string) => setChangePasswordForm({ ...changePasswordForm, newPassword: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={changePasswordForm.confirmPassword}
                  onChangeText={(text: string) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: text })}
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="modal-actions">
                <Button variant="neutral" onPress={handleCloseChangePasswordModal} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={() => handleChangePassword({ preventDefault: () => {} } as React.FormEvent)} disabled={loading} loading={loading}>
                  Change Password
                </Button>
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
              <Button variant="neutral" onPress={() => setShowDeleteConfirm(null)} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => handleDeleteUser(showDeleteConfirm)}
                disabled={loading}
                loading={loading}
                className="delete-confirm-btn"
              >
                Delete User
              </Button>
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
              <Button variant="neutral" onPress={() => setShowSwitchConfirm(null)} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => handleSwitchVersion(showSwitchConfirm)}
                disabled={loading}
                loading={loading}
                className="activate-confirm-btn"
              >
                Activate Version
              </Button>
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
                            <Button
                              variant="neutral"
                              onPress={() => handleDownloadFile(file.path)}
                              className="file-download-btn"
                              accessibilityLabel="Download file"
                              disabled={loading}
                            >
                              <span>⬇️</span> Download
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="neutral" onPress={() => setShowManifestModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Observation View Modal */}
      {showObservationModal && selectedObservation && (
        <div className="modal-overlay" onClick={() => setShowObservationModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Observation Details</h2>
              <button className="modal-close" onClick={() => setShowObservationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="observation-details">
                <div className="info-row">
                  <strong>Observation ID:</strong>
                  <code className="observation-id-code observation-id-code-block">
                    {selectedObservation.observation_id}
                  </code>
                </div>
                <div className="info-row">
                  <strong>Form Type:</strong>
                  <span>{selectedObservation.form_type || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <strong>Form Version:</strong>
                  <span>{selectedObservation.form_version || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <strong>Version:</strong>
                  <span style={{ fontFamily: 'monospace' }}>{selectedObservation.version || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <strong>Status:</strong>
                  <span>
                    {selectedObservation.deleted ? (
                      <Badge variant="error">Deleted</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </span>
                </div>
                <div className="info-row">
                  <strong>Created At:</strong>
                  <span>{selectedObservation.created_at ? new Date(selectedObservation.created_at).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="info-row">
                  <strong>Updated At:</strong>
                  <span>{selectedObservation.updated_at ? new Date(selectedObservation.updated_at).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="info-row">
                  <strong>Synced At:</strong>
                  <span>{selectedObservation.synced_at ? new Date(selectedObservation.synced_at).toLocaleString() : 'Not synced'}</span>
                </div>
                {selectedObservation.geolocation && (
                  <div className="info-row">
                    <strong>Geolocation:</strong>
                    <div className="geolocation-info">
                      <div>Latitude: {selectedObservation.geolocation.latitude}</div>
                      <div>Longitude: {selectedObservation.geolocation.longitude}</div>
                      {selectedObservation.geolocation.accuracy && (
                        <div>Accuracy: {selectedObservation.geolocation.accuracy}m</div>
                      )}
                    </div>
                  </div>
                )}
                {selectedObservation.data && (
                  <div className="info-row column-layout">
                    <strong>Data:</strong>
                    <pre className="observation-data-pre">
                      {typeof selectedObservation.data === 'string' 
                        ? selectedObservation.data 
                        : JSON.stringify(selectedObservation.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="neutral" onPress={() => setShowObservationModal(false)}>
                Close
              </Button>
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
              <Button variant="neutral" onPress={() => setShowChangesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
