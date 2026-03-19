import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { PORTAL_VERSION } from '../version';
import { Button, Input, Badge } from '@ode/components/react-web';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

import {
  HiOutlineCube,
  HiCube,
  HiOutlineUsers,
  HiUsers,
  HiCheckCircle,
  HiExclamationTriangle,
  HiArrowUpTray,
  HiArrowDownTray,
  HiArrowPath,
  HiMagnifyingGlass,
  HiKey,
  HiTrash,
  HiDocumentText,
  HiChevronDown,
  HiPlus,
  HiXMark,
  HiChartBar,
} from 'react-icons/hi2';
import { ColorBrandPrimary500 } from '@ode/tokens';
import odeLogo from '../assets/ode-logo-round.png';
import dashboardBackgroundDark from '../assets/dashboard-background.png';
import dashboardBackgroundLight from '../assets/dashboard-background-light.png';
import './Dashboard.css';

const BRAND_PRIMARY = ColorBrandPrimary500;

type TabType =
  | 'users'
  | 'app-bundles'
  | 'data-export';

interface AppBundleVersion {
  version: string;
  createdAt?: string;
  isActive?: boolean;
}

interface AppBundleManifest {
  version: string;
  files: Array<{ path: string; hash: string; size: number }>;
  hash: string;
}

interface AppBundleChanges {
  compare_version_a?: string;
  compare_version_b?: string;
  added?: Array<{ path: string; hash: string; size: number }>;
  removed?: Array<{ path: string; hash: string; size: number }>;
  modified?: Array<{
    path: string;
    hash_a: string;
    hash_b: string;
    size_a: number;
    size_b: number;
  }>;
}

interface AppBundleVersionsResponse {
  versions: string[];
}

interface User {
  username: string;
  role: string;
  createdAt?: string;
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [appBundles, setAppBundles] = useState<AppBundleVersion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Prevents overlapping listUsers calls without putting `loading` in loadUsers deps (which would retrigger the initial-load effect). */
  const usersFetchInFlightRef = useRef(false);

  // User management modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  // Form states
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    password: '',
    role: 'read-only',
  });
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Clear form when modal opens/closes
  const handleOpenCreateUserModal = () => {
    setCreateUserForm({ username: '', password: '', role: 'read-only' });
    setRoleDropdownOpen(false);
    setShowCreateUserModal(true);
  };

  const handleCloseCreateUserModal = () => {
    setCreateUserForm({ username: '', password: '', role: 'read-only' });
    setRoleDropdownOpen(false);
    setShowCreateUserModal(false);
  };

  const handleRoleSelect = (role: string) => {
    setCreateUserForm({ ...createUserForm, role });
    setRoleDropdownOpen(false);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'read-only':
        return 'Read Only';
      case 'read-write':
        return 'Read Write';
      case 'admin':
        return 'Admin';
      default:
        return 'Select Role';
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setRoleDropdownOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (roleDropdownOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [roleDropdownOpen, mobileMenuOpen]);

  // Handle scroll to make navbar more opaque
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollY > 10); // Trigger when scrolled more than 10px
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [resetPasswordForm, setResetPasswordForm] = useState({
    username: '',
    newPassword: '',
  });
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // App bundle modals
  const [autoActivate, setAutoActivate] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<string | null>(
    null,
  );
  const [currentManifest, setCurrentManifest] =
    useState<AppBundleManifest | null>(null);
  const [bundleChanges, setBundleChanges] = useState<AppBundleChanges | null>(
    null,
  );
  const [activeVersion, setActiveVersion] = useState<string | null>(null);

  const loadAppBundles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get versions and manifest to determine active version
      const [versionsResponse, manifest] = await Promise.all([
        api.get<AppBundleVersionsResponse>('/app-bundle/versions'),
        api.getAppBundleManifest().catch(() => null), // Manifest might not exist if no bundle is active
      ]);

      const activeVer = manifest?.version || null;
      setActiveVersion(activeVer);

      const versions: AppBundleVersion[] = (
        versionsResponse.versions || []
      ).map((v: string) => {
        // Remove asterisk suffix if present (CLI marks active version with *)
        const cleanVersion = v.replace(/\s*\*$/, '');
        return {
          version: cleanVersion,
          isActive: cleanVersion === activeVer,
        };
      });
      setAppBundles(versions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load app bundles',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchVersion = async (version: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.switchAppBundleVersion(version);
      setSuccess(`Successfully switched to version ${version}`);
      setShowSwitchConfirm(null);
      await loadAppBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch version');
    } finally {
      setLoading(false);
    }
  };

  const handleViewManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const manifest = await api.getAppBundleManifest();
      setCurrentManifest(manifest);
      setShowManifestModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChanges = async (targetVersion: string) => {
    setLoading(true);
    setError(null);
    try {
      const changes = await api.getAppBundleChanges(
        activeVersion || undefined,
        targetVersion,
      );
      setBundleChanges(changes);
      setShowChangesModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changes');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (filePath: string) => {
    setLoading(true);
    setError(null);
    try {
      const blob = await api.downloadAppBundleFile(filePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from path
      const filename = filePath.split('/').pop() || filePath;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess(`File ${filename} downloaded successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = useCallback(async () => {
    if (user?.role !== 'admin') {
      setError('Admin access required');
      return;
    }

    if (usersFetchInFlightRef.current) return;
    usersFetchInFlightRef.current = true;

    setLoading(true);
    setError(null);
    try {
      const userList = await api.listUsers();
      setUsers(Array.isArray(userList) ? userList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
      usersFetchInFlightRef.current = false;
    }
  }, [user?.role]);

  
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);

    if (tab === 'app-bundles') {
      // Always refresh app bundles to get latest activated version
      loadAppBundles();
    } else if (tab === 'users' && users.length === 0) {
      loadUsers();
    }
  };

  // Initial load: after login, the "users" tab is already active, but
  // handleTabChange() won't run again. So explicitly fetch users when the
  // logged-in user becomes an admin and the Users tab is active.
  useEffect(() => {
    if (activeTab !== 'users') return;
    if (user?.role !== 'admin') return;
    if (users.length !== 0) return;
    loadUsers();
  }, [activeTab, user?.role, users.length, loadUsers]);

  const handleUploadClick = () => {
    if (loading) return;
    // Use setTimeout to ensure the click happens after any state updates
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 0);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Enhanced file validation
    if (!file.name.endsWith('.zip')) {
      setError('Invalid file format. Please upload a valid ZIP file (.zip extension required)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // File size validation (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 50MB. Please compress your bundle and try again.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Your session has expired. Please log in again and try uploading.');
      // Redirect to login or show login modal
      setTimeout(() => {
        window.location.reload(); // Simple redirect to login page
      }, 3000);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('bundle', file);

      const token = localStorage.getItem('token');

      // Use Promise wrapper for XMLHttpRequest
      const result = await new Promise<any>((resolve, reject) => {
        // Use XMLHttpRequest for upload progress (don't set Content-Type - browser does it automatically with boundary)
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else if (xhr.status === 401) {
            // Auth error
            reject(new Error('Your session has expired. Please log in again.'));
          } else if (xhr.status === 413) {
            // Payload too large
            reject(new Error('File too large. Maximum size is 50MB.'));
          } else if (xhr.status === 400) {
            // Bad request - validation error
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(
                new Error(
                  `Validation failed: ${errorData.message || errorData.error || 'Invalid file format or content'}`,
                ),
              );
            } catch (_e) {
              reject(new Error('Validation failed: Invalid file format or content'));
            }
          } else if (xhr.status >= 500) {
            // Server error
            reject(new Error('Server error. Please try again later or contact support if the problem persists.'));
          } else {
            // Other HTTP errors
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(
                new Error(
                  errorData.message ||
                    errorData.error ||
                    `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
                ),
              );
            } catch (_e) {
              reject(
                new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`),
              );
            }
          }
        });

        xhr.addEventListener('error', () =>
          reject(new Error('Network error: Unable to connect to server. Please check your internet connection and try again.')),
        );
        
        xhr.addEventListener('timeout', () =>
          reject(new Error('Upload timeout: The upload took too long (2-minute limit). Please try again with a smaller file or better connection.')),
        );
        
        xhr.addEventListener('abort', () =>
          reject(new Error('Upload was cancelled')),
        );

        const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
        const uploadUrl = `${apiBaseUrl}/app-bundle/push`;
        xhr.open('POST', uploadUrl);
        
        // Set timeout for upload (2 minutes)
        xhr.timeout = 2 * 60 * 1000; // 2 minutes in ms
        
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.setRequestHeader('x-formulus-version', PORTAL_VERSION);
        // Don't set Content-Type - browser sets it automatically with boundary for FormData
        xhr.send(formData);
      });

      setSuccess(
        `Bundle uploaded successfully! Version: ${result.manifest?.version || result.version || 'N/A'}`,
      );
      setUploadProgress(100);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await loadAppBundles();

      // Auto-activate if enabled
      if (autoActivate && result.manifest?.version) {
        try {
          await api.switchAppBundleVersion(result.manifest.version);
          setSuccess(
            `Bundle uploaded and activated! Version: ${result.manifest.version}`,
          );
          await loadAppBundles();
        } catch (err) {
          setError(
            `Bundle uploaded but failed to activate: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }

      setTimeout(() => {
        setUploadProgress(0);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload bundle');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // User management handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.username || !createUserForm.password) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.createUser(createUserForm);
      setSuccess('User created successfully!');
      // Clear form immediately
      setCreateUserForm({ username: '', password: '', role: 'read-only' });
      setShowCreateUserModal(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!username) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.deleteUser(username);
      setSuccess(`User ${username} deleted successfully!`);
      setShowDeleteConfirm(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordForm.username || !resetPasswordForm.newPassword) {
      setError('Username and new password are required');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.resetPassword(resetPasswordForm);
      setSuccess(
        `Password reset successfully for ${resetPasswordForm.username}!`,
      );
      // Clear form immediately
      setResetPasswordForm({ username: '', newPassword: '' });
      setShowResetPasswordModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseResetPasswordModal = () => {
    setResetPasswordForm({ username: '', newPassword: '' });
    setShowResetPasswordModal(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !changePasswordForm.currentPassword ||
      !changePasswordForm.newPassword
    ) {
      setError('Current password and new password are required');
      return;
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.changePassword({
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword,
      });
      setSuccess('Password changed successfully!');
      // Clear form immediately
      setChangePasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowChangePasswordModal(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to change password',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseChangePasswordModal = () => {
    setChangePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowChangePasswordModal(false);
  };

  const handleOpenChangePasswordModal = () => {
    setChangePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowChangePasswordModal(true);
  };

  const dashboardBackground =
    resolvedTheme === 'light'
      ? dashboardBackgroundLight
      : dashboardBackgroundDark;

  return (
    <div
      className="dashboard"
      style={
        {
          '--dashboard-bg-image': `url(${dashboardBackground})`,
        } as React.CSSProperties
      }>
      <header className={`dashboard-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="header-content">
          <div className="logo-section">
            <img src={odeLogo} alt="ODE Logo" className="logo-icon" />
            <h1>Synkronus Portal</h1>
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="welcome-text">Welcome back:</span>
            </div>
            <Badge variant={user?.role === 'admin' ? 'primary' : 'neutral'}>
              {user?.role}
            </Badge>
            <ThemeSwitcher />
            <Button
              variant="neutral"
              onPress={logout}
              className="logout-button">
              Logout
            </Button>
            <button
              className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                // When menu is open (X is active), only close it (don't toggle)
                if (mobileMenuOpen) {
                  setMobileMenuOpen(false);
                  return; // Exit early to prevent any further execution
                }
                // When menu is closed (3 lines), open it
                setMobileMenuOpen(true);
              }}
              onMouseDown={e => {
                // Prevent backdrop click from firing when clicking the button
                e.stopPropagation();
              }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={e => {
            // Only close if clicking directly on backdrop (not through navbar)
            const target = e.target as HTMLElement;
            if (target.classList.contains('mobile-menu-backdrop')) {
              setMobileMenuOpen(false);
            }
          }}
        />
      )}

      {/* Mobile Menu */}
      <div
        className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        ref={mobileMenuRef}>
        <div className="mobile-menu-content">
          <div className="mobile-menu-header">
            <div className="mobile-menu-user-info">
              <span className="mobile-menu-welcome-text">Welcome back:</span>
              <Badge variant={user?.role === 'admin' ? 'primary' : 'neutral'}>
                {user?.role}
              </Badge>
            </div>
          </div>
          <div className="mobile-menu-actions">
            <div className="mobile-menu-action-item">
              <span className="mobile-menu-action-label">Theme</span>
              <div className="mobile-menu-theme-switcher">
                <ThemeSwitcher />
              </div>
            </div>
            <div className="mobile-menu-action-item mobile-menu-logout-item">
              <span className="mobile-menu-action-label">Account</span>
              <button onClick={logout} className="mobile-menu-logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="dashboard-content">
        <nav className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''} fade-left`}
            onClick={() => handleTabChange('users')}>
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient
                  id="border-fade-left-0"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%">
                  <stop offset="0%" stopColor={BRAND_PRIMARY} stopOpacity="0" />
                  <stop
                    offset="15%"
                    stopColor={BRAND_PRIMARY}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={BRAND_PRIMARY}
                    stopOpacity="1"
                  />
                </linearGradient>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="8"
                stroke="url(#border-fade-left-0)"
              />
            </svg>
            <span className="tab-icon">
              {activeTab === 'users' ? <HiUsers /> : <HiOutlineUsers />}
            </span>
            <span>Users</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'app-bundles' ? 'active' : ''} fade-right`}
            onClick={() => handleTabChange('app-bundles')}>
            <svg className="border-fade" preserveAspectRatio="none">
              <defs>
                <linearGradient
                  id="border-fade-right-0"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%">
                  <stop offset="0%" stopColor={BRAND_PRIMARY} stopOpacity="1" />
                  <stop
                    offset="85%"
                    stopColor={BRAND_PRIMARY}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={BRAND_PRIMARY}
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="8"
                stroke="url(#border-fade-right-0)"
              />
            </svg>
            <span className="tab-icon">
              {activeTab === 'app-bundles' ? <HiCube /> : <HiOutlineCube />}
            </span>
            <span>App Bundles</span>
          </button>
          {user?.role === 'admin' && (
            <button
              className={`tab-button ${activeTab === 'data-export' ? 'active' : ''} fade-right`}
              onClick={() => handleTabChange('data-export')}>
              <svg className="border-fade" preserveAspectRatio="none">
                <defs>
                  <linearGradient
                    id="border-fade-data-export"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%">
                    <stop offset="0%" stopColor={BRAND_PRIMARY} stopOpacity="1" />
                    <stop
                      offset="85%"
                      stopColor={BRAND_PRIMARY}
                      stopOpacity="1"
                    />
                    <stop
                      offset="100%"
                      stopColor={BRAND_PRIMARY}
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  stroke="url(#border-fade-data-export)"
                />
              </svg>
              <span className="tab-icon">
                {activeTab === 'data-export' ? <HiArrowDownTray /> : <HiArrowDownTray />}
              </span>
              <span>Data Export</span>
            </button>
          )}
        </nav>

        {error && (
          <div className="alert-banner error">
            <span className="alert-icon">
              <HiExclamationTriangle />
            </span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="alert-close">
              <HiXMark />
            </button>
          </div>
        )}

        {success && (
          <div className="alert-banner success">
            <span className="alert-icon">
              <HiCheckCircle />
            </span>
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="alert-close">
              <HiXMark />
            </button>
          </div>
        )}

        <div className="tab-content">
          
          {activeTab === 'app-bundles' && (
            <div className="app-bundles-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>App Bundles</h2>
                  <p className="section-subtitle">
                    Manage your application bundles
                  </p>
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
                        position="right"
                        className="upload-button">
                        <HiArrowUpTray /> Upload Bundle
                      </Button>
                      <label className="auto-activate-toggle">
                        <input
                          type="checkbox"
                          checked={autoActivate}
                          onChange={e => setAutoActivate(e.target.checked)}
                          disabled={loading}
                        />
                        <span>Auto-activate</span>
                        <small className="auto-activate-hint">
                          Check BEFORE uploading to auto-activate the bundle
                        </small>
                      </label>
                    </>
                  )}
                  <Button
                    variant="neutral"
                    onPress={loadAppBundles}
                    disabled={loading}
                    position="left"
                    className="refresh-button">
                    <HiArrowPath /> Refresh
                  </Button>
                </div>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <span className="progress-text">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
              )}

              {loading && appBundles.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading app bundles...</p>
                </div>
              ) : appBundles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <HiCube />
                  </div>
                  <h3>No App Bundles</h3>
                  <p>Upload your first app bundle to get started</p>
                </div>
              ) : (
                <div className="bundles-grid">
                  {appBundles.map(bundle => (
                    <div key={bundle.version} className="bundle-card">
                      <div className="bundle-header">
                        <div className="bundle-icon">
                          <HiCube />
                        </div>
                        <div className="bundle-info">
                          <h3>Version {bundle.version}</h3>
                          <Badge
                            variant={bundle.isActive ? 'success' : 'neutral'}>
                            {bundle.isActive ? '● Active' : '○ Inactive'}
                          </Badge>
                        </div>
                      </div>
                      {bundle.createdAt && (
                        <div className="bundle-meta">
                          <span>
                            Created:{' '}
                            {new Date(bundle.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="bundle-actions">
                        {user?.role === 'admin' && !bundle.isActive && (
                          <Button
                            variant="primary"
                            onPress={() => setShowSwitchConfirm(bundle.version)}
                            position="left"
                            className="bundle-action-btn activate-btn"
                            accessibilityLabel="Activate this version">
                            <HiArrowPath /> Activate
                          </Button>
                        )}
                        <Button
                          variant="neutral"
                          onPress={() => handleViewChanges(bundle.version)}
                          position={
                            user?.role === 'admin' && !bundle.isActive
                              ? 'right'
                              : 'standalone'
                          }
                          className="bundle-action-btn changes-btn"
                          accessibilityLabel="View changes from current version"
                          disabled={bundle.isActive || !activeVersion}>
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
                  <Button
                    variant="neutral"
                    onPress={handleViewManifest}
                    className="view-manifest-btn">
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
                  <p className="section-subtitle">
                    Manage system users and permissions
                  </p>
                </div>
                <div className="section-actions">
                  <Button
                    variant="primary"
                    onPress={handleOpenCreateUserModal}
                    disabled={loading}
                    position="right"
                    className="create-button">
                    <HiPlus /> Create User
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={handleOpenChangePasswordModal}
                    disabled={loading}
                    className="change-password-button">
                    <HiKey /> Change my password
                  </Button>
                  <Button
                    variant="neutral"
                    onPress={loadUsers}
                    disabled={loading}
                    position="left"
                    className="refresh-button">
                    <HiArrowPath /> Refresh
                  </Button>
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
                  <div className="search-bar">
                    <div className="search-input-wrapper">
                      <Input
                        type="text"
                        placeholder="Search users by username or role..."
                        value={userSearchQuery}
                        onChangeText={setUserSearchQuery}
                        className="search-input"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          marginBottom: 0,
                        }}
                      />
                      {userSearchQuery && (
                        <button
                          type="button"
                          className="search-clear-icon"
                          onClick={() => setUserSearchQuery('')}
                          aria-label="Clear search">
                          <HiXMark />
                        </button>
                      )}
                      <button
                        type="button"
                        className="search-icon-button"
                        onClick={() => {
                          const input = document.querySelector(
                            '.users-table-container .search-input input',
                          ) as HTMLInputElement;
                          if (input) {
                            input.focus();
                          }
                        }}
                        aria-label="Search">
                        <HiMagnifyingGlass />
                      </button>
                    </div>
                  </div>
                  <div className="users-table-section">
                    <div className="table-container">
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
                            .filter(u => {
                              if (!userSearchQuery) return true;
                              const query = userSearchQuery.toLowerCase();
                              return (
                                u.username.toLowerCase().includes(query) ||
                                u.role.toLowerCase().includes(query)
                              );
                            })
                            .map(u => (
                              <tr key={u.username}>
                                <td>
                                  <div className="user-cell">
                                    <div className="user-avatar-small">
                                      {u.username.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="user-name">
                                      {u.username}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <Badge
                                    variant={
                                      u.role === 'admin'
                                        ? 'primary'
                                        : u.role === 'read-write'
                                          ? 'secondary'
                                          : 'neutral'
                                    }>
                                    {u.role}
                                  </Badge>
                                </td>
                                <td>
                                  <span className="created-date">
                                    {u.createdAt
                                      ? new Date(
                                          u.createdAt,
                                        ).toLocaleDateString('en-US', {
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
                                        setResetPasswordForm({
                                          username: u.username,
                                          newPassword: '',
                                        });
                                        setShowResetPasswordModal(true);
                                      }}
                                      position="left"
                                      className="table-action-btn reset-password-btn"
                                      accessibilityLabel="Reset Password">
                                      <HiKey /> Reset Password
                                    </Button>
                                    <Button
                                      variant="neutral"
                                      onPress={() =>
                                        setShowDeleteConfirm(u.username)
                                      }
                                      position="right"
                                      className="table-action-btn delete-btn"
                                      accessibilityLabel="Delete User">
                                      <HiTrash /> Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {users.filter(u => {
                      if (!userSearchQuery) return true;
                      const query = userSearchQuery.toLowerCase();
                      return (
                        u.username.toLowerCase().includes(query) ||
                        u.role.toLowerCase().includes(query)
                      );
                    }).length === 0 && (
                      <div
                        className={
                          userSearchQuery
                            ? 'user-search-empty'
                            : 'empty-state users-empty-state'
                        }>
                        <div className="empty-icon">
                          <HiUsers />
                        </div>
                        <h3>
                          {userSearchQuery
                            ? 'No users found'
                            : 'No Users Found'}
                        </h3>
                        <p>
                          {userSearchQuery
                            ? 'Try adjusting your search query'
                            : 'Create your first user to get started'}
                        </p>
                        {userSearchQuery && (
                          <Button
                            variant="neutral"
                            onPress={() => setUserSearchQuery('')}
                            className="clear-search-button"
                            position="standalone">
                            Clear Search
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && user?.role !== 'admin' && (
            <div className="users-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>My Account</h2>
                  <p className="section-subtitle">
                    Manage your account settings
                  </p>
                </div>
                <Button
                  variant="primary"
                  onPress={handleOpenChangePasswordModal}
                  className="change-password-button">
                  <HiKey /> Change Password
                </Button>
              </div>
              <div className="user-info-card">
                <div className="user-avatar-large">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{user?.username}</h3>
                  <Badge
                    variant={
                      user?.role === 'admin'
                        ? 'primary'
                        : user?.role === 'read-write'
                          ? 'secondary'
                          : 'neutral'
                    }>
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data-export' && (
            <div className="data-export-section">
              <div className="section-header">
                <div className="section-title">
                  <h2>Data Export</h2>
                  <p className="section-subtitle">
                    Export observation data as Parquet files
                  </p>
                </div>
              </div>
              <div className="export-options">
                <div className="export-card">
                  <div className="export-icon">
                    <HiArrowDownTray />
                  </div>
                  <div className="export-content">
                    <h3>Export All Data</h3>
                    <p>Download all observation data as ZIP containing multiple Parquet files (one per form type)</p>
                    <Button
                      variant="primary"
                      onPress={async () => {
                        try {
                          const apiUrl = import.meta.env.VITE_API_URL || '/api';
                          const token = localStorage.getItem('token');
                          const response = await fetch(`${apiUrl}/dataexport/parquet`, {
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'x-formulus-version': '1.0.0'
                            }
                          });
                          if (!response.ok) {
                            throw new Error(`Export failed: ${response.statusText}`);
                          }
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `parquet-export-${new Date().toISOString().split('T')[0]}.zip`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                          setSuccess('Parquet files downloaded successfully!');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Export failed');
                        }
                      }}
                      disabled={loading}
                      className="export-button">
                      <HiArrowDownTray /> Export Parquet
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="modal-overlay" onClick={handleCloseCreateUserModal}>
          <div
            className="modal-content modal-create-user"
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New User</h2>
              <button
                className="modal-close"
                onClick={handleCloseCreateUserModal}>
                ×
              </button>
            </div>
            <form
              onSubmit={handleCreateUser}
              className="modal-form"
              autoComplete="off">
              <div className="form-group">
                <Input
                  label="Username"
                  type="text"
                  value={createUserForm.username}
                  onChangeText={(text: string) =>
                    setCreateUserForm({ ...createUserForm, username: text })
                  }
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
                  onChangeText={(text: string) =>
                    setCreateUserForm({ ...createUserForm, password: text })
                  }
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <div className="role-dropdown-container" ref={roleDropdownRef}>
                  <button
                    type="button"
                    className={`role-select-button ${roleDropdownOpen ? 'open' : ''}`}
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    disabled={loading}>
                    <span>{getRoleDisplayName(createUserForm.role)}</span>
                    <HiChevronDown
                      className={`chevron-icon ${roleDropdownOpen ? 'open' : ''}`}
                    />
                  </button>
                  {roleDropdownOpen && (
                    <div className="role-dropdown-menu">
                      <button
                        type="button"
                        className={`role-option ${createUserForm.role === 'read-only' ? 'selected' : ''}`}
                        onClick={() => handleRoleSelect('read-only')}>
                        <span className="role-name">Read Only</span>
                        <span className="role-description">
                          View-only access
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`role-option ${createUserForm.role === 'read-write' ? 'selected' : ''}`}
                        onClick={() => handleRoleSelect('read-write')}>
                        <span className="role-name">Read Write</span>
                        <span className="role-description">
                          Can create and edit
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`role-option ${createUserForm.role === 'admin' ? 'selected' : ''}`}
                        onClick={() => handleRoleSelect('admin')}>
                        <span className="role-name">Admin</span>
                        <span className="role-description">
                          Full system access
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <Button
                  variant="neutral"
                  onPress={handleCloseCreateUserModal}
                  disabled={loading}
                  position="left">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() =>
                    handleCreateUser({
                      preventDefault: () => {},
                    } as React.FormEvent)
                  }
                  disabled={loading}
                  loading={loading}
                  position="right">
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button
                className="modal-close"
                onClick={() => setShowResetPasswordModal(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={handleResetPassword}
              className="modal-form"
              autoComplete="off">
              <div className="form-group">
                <Input
                  label="Username"
                  type="text"
                  value={resetPasswordForm.username}
                  onChangeText={(text: string) =>
                    setResetPasswordForm({
                      ...resetPasswordForm,
                      username: text,
                    })
                  }
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
                  onChangeText={(text: string) =>
                    setResetPasswordForm({
                      ...resetPasswordForm,
                      newPassword: text,
                    })
                  }
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="modal-actions">
                <Button
                  variant="neutral"
                  onPress={handleCloseResetPasswordModal}
                  disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() =>
                    handleResetPassword({
                      preventDefault: () => {},
                    } as React.FormEvent)
                  }
                  disabled={loading}
                  loading={loading}>
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button
                className="modal-close"
                onClick={handleCloseChangePasswordModal}>
                ×
              </button>
            </div>
            <form
              onSubmit={handleChangePassword}
              className="modal-form"
              autoComplete="off">
              <div className="form-group">
                <Input
                  label="Current Password"
                  type="password"
                  value={changePasswordForm.currentPassword}
                  onChangeText={(text: string) =>
                    setChangePasswordForm({
                      ...changePasswordForm,
                      currentPassword: text,
                    })
                  }
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
                  onChangeText={(text: string) =>
                    setChangePasswordForm({
                      ...changePasswordForm,
                      newPassword: text,
                    })
                  }
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
                  onChangeText={(text: string) =>
                    setChangePasswordForm({
                      ...changePasswordForm,
                      confirmPassword: text,
                    })
                  }
                  required
                  disabled={loading}
                  className="modal-input"
                />
              </div>
              <div className="modal-actions">
                <Button
                  variant="neutral"
                  onPress={handleCloseChangePasswordModal}
                  disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() =>
                    handleChangePassword({
                      preventDefault: () => {},
                    } as React.FormEvent)
                  }
                  disabled={loading}
                  loading={loading}>
                  Change Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button
                className="modal-close"
                onClick={() => setShowDeleteConfirm(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete user{' '}
                <strong>{showDeleteConfirm}</strong>? This action cannot be
                undone.
              </p>
            </div>
            <div className="modal-actions">
              <Button
                variant="neutral"
                onPress={() => setShowDeleteConfirm(null)}
                disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => handleDeleteUser(showDeleteConfirm)}
                disabled={loading}
                loading={loading}
                className="delete-confirm-btn">
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Version Confirmation Modal */}
      {showSwitchConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowSwitchConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Activate Bundle Version</h2>
              <button
                className="modal-close"
                onClick={() => setShowSwitchConfirm(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to activate version{' '}
                <strong>{showSwitchConfirm}</strong>? This will switch the
                active app bundle to this version.
              </p>
            </div>
            <div className="modal-actions">
              <Button
                variant="neutral"
                onPress={() => setShowSwitchConfirm(null)}
                disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => handleSwitchVersion(showSwitchConfirm)}
                disabled={loading}
                loading={loading}
                className="activate-confirm-btn">
                Activate Version
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manifest Modal */}
      {showManifestModal && currentManifest && (
        <div
          className="modal-overlay"
          onClick={() => setShowManifestModal(false)}>
          <div
            className="modal-content modal-large"
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>App Bundle Manifest</h2>
              <button
                className="modal-close"
                onClick={() => setShowManifestModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="manifest-info">
                <div className="info-row">
                  <strong>Version:</strong>{' '}
                  <span>{currentManifest.version}</span>
                </div>
                <div className="info-row">
                  <strong>Hash:</strong>{' '}
                  <span className="hash-value">{currentManifest.hash}</span>
                </div>
                <div className="info-row">
                  <strong>Files:</strong>{' '}
                  <span>{currentManifest.files.length}</span>
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
                              disabled={loading}>
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
              <Button
                variant="neutral"
                onPress={() => setShowManifestModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Changes Modal */}
      {showChangesModal && bundleChanges && (
        <div
          className="modal-overlay"
          onClick={() => setShowChangesModal(false)}>
          <div
            className="modal-content modal-large"
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Version Changes</h2>
              <button
                className="modal-close"
                onClick={() => setShowChangesModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="changes-info">
                {bundleChanges.compare_version_a &&
                  bundleChanges.compare_version_b && (
                    <div className="info-row">
                      <strong>Comparing:</strong>{' '}
                      <span>
                        {bundleChanges.compare_version_a} →{' '}
                        {bundleChanges.compare_version_b}
                      </span>
                    </div>
                  )}
              </div>
              {bundleChanges.added && bundleChanges.added.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-added">
                    ➕ Added ({bundleChanges.added.length})
                  </h3>
                  <ul className="changes-list">
                    {bundleChanges.added.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bundleChanges.removed && bundleChanges.removed.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-removed">
                    ➖ Removed ({bundleChanges.removed.length})
                  </h3>
                  <ul className="changes-list">
                    {bundleChanges.removed.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bundleChanges.modified && bundleChanges.modified.length > 0 && (
                <div className="changes-section">
                  <h3 className="changes-modified">
                    ✏️ Modified ({bundleChanges.modified.length})
                  </h3>
                  <ul className="changes-list">
                    {bundleChanges.modified.map((file, idx) => (
                      <li key={idx}>{file.path}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(!bundleChanges.added || bundleChanges.added.length === 0) &&
                (!bundleChanges.removed ||
                  bundleChanges.removed.length === 0) &&
                (!bundleChanges.modified ||
                  bundleChanges.modified.length === 0) && (
                  <p className="no-changes">
                    No changes detected between versions.
                  </p>
                )}
            </div>
            <div className="modal-actions">
              <Button
                variant="neutral"
                onPress={() => setShowChangesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
