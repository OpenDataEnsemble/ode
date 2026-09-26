---
sidebar_position: 9
---

# Synkronus Portal Reference

Complete technical reference for the Synkronus Portal web interface.

## Overview

Synkronus Portal is a web-based administrative interface for managing Synkronus server operations. It provides a user-friendly interface for app bundle management, user administration, observation viewing, and data export. The portal is built with React, TypeScript, and Vite.

## Architecture

### Technology Stack

- **Framework**: React 19.2.0
- **Language**: TypeScript
- **Build Tool**: Vite 7.2.4
- **State Management**: React Context API
- **HTTP Client**: Fetch API with custom wrapper
- **Styling**: CSS (with ODE design tokens)

### Project Structure

```
synkronus-portal/
├── src/
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Root component
│   ├── types/
│   │   └── auth.ts          # TypeScript interfaces
│   ├── services/
│   │   └── api.ts           # HTTP client
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication state
│   ├── components/
│   │   ├── Login.tsx        # Login component
│   │   └── ProtectedRoute.tsx # Route protection
│   └── pages/
│       └── Dashboard.tsx    # Main dashboard
├── index.html                # HTML entry point
└── vite.config.ts           # Vite configuration
```

## Core Features

### Authentication

- **JWT-based Auth**: Secure token authentication
- **Token Refresh**: Automatic token refresh
- **Session Management**: Persistent login sessions
- **Protected Routes**: Route-level access control

### App Bundle Management

- **View Versions**: List all app bundle versions
- **Upload Bundles**: Upload new app bundles
- **Switch Versions**: Activate specific bundle versions
- **Download Bundles**: Download bundle files
- **Version History**: View version history

### User Management

- **List Users**: View all users
- **Create Users**: Add new users
- **Edit Users**: Update user information
- **Delete Users**: Remove users
- **Role Management**: Assign user roles

### Observation Management

- **View Observations**: Browse collected observations
- **Filter Observations**: Filter by form type, date, etc.
- **Search**: Search observations
- **Export**: Export observations in various formats

### Data Export

- **Parquet Export**: Export as Parquet ZIP
- **JSON Export**: Export as JSON
- **CSV Export**: Export as CSV
- **Filtered Export**: Export filtered data

## User Interface

### Dashboard

The main dashboard provides:

- **Overview Statistics**: Total observations, users, bundles
- **Recent Activity**: Latest observations and changes
- **Quick Actions**: Common administrative tasks
- **System Status**: Server health and status

### Navigation

- **Sidebar Navigation**: Access to all sections
- **Breadcrumbs**: Current location indicator
- **User Menu**: User profile and logout
- **Notifications**: System notifications

## API Integration

### API Service

The portal uses a centralized API service:

```typescript
import { api } from './services/api'

// Login
await api.login(username, password)

// Get data
const users = await api.get('/users')

// Post data
await api.post('/users/create', userData)
```

### Authentication Flow

1. User enters credentials
2. Portal sends login request to `/auth/login`
3. Server returns JWT token
4. Token stored in localStorage
5. Token included in all subsequent requests

### Error Handling

The API service handles errors:

- **Network Errors**: Connection failures
- **401 Unauthorized**: Invalid credentials
- **500+ Errors**: Server errors
- **API Errors**: Structured error responses

## Configuration

### Development Mode

**Vite Dev Server:**
- Port: 5174
- Hot Module Replacement: Enabled
- Proxy: `/api/*` → `http://localhost:8080/*`

**Start Development:**
```bash
pnpm run dev
```

### Production Mode

**Nginx Serving:**
- Port: 80 (exposed as 5173)
- Static files from `/usr/share/nginx/html`
- API proxy: `/api/*` → `http://synkronus:8080/*`

**Build for Production:**
```bash
pnpm run build
```

### Environment Variables

- `VITE_API_URL`: Override API base URL (optional)
- `DOCKER_ENV`: Set to `true` in Docker (optional)

## Deployment

### Docker Deployment

The portal can be deployed with Docker:

```bash
docker compose up -d
```

**Docker Compose Services:**
- `synkronus-portal`: Frontend portal
- `synkronus`: Backend API
- `postgres`: Database

### Standalone Deployment

Build and serve with any static file server:

```bash
pnpm run build
# Serve dist/ directory
```

## Development

### Local Development Setup

1. **Install Dependencies:**
   ```bash
   pnpm install
   ```

2. **Start Backend:**
   ```bash
   # In synkronus directory
   go run cmd/synkronus/main.go
   ```

3. **Start Portal:**
   ```bash
   pnpm run dev
   ```

4. **Access Portal:**
   - Open http://localhost:5174

### Adding New Features

#### Add API Endpoint

1. **Add TypeScript Types:**
   ```typescript
   // src/types/feature.ts
   export interface FeatureRequest {
     field: string
   }
   ```

2. **Add API Method:**
   ```typescript
   // src/services/api.ts
   async getFeature(id: string): Promise<FeatureResponse> {
     return this.get<FeatureResponse>(`/feature/${id}`)
   }
   ```

3. **Use in Component:**
   ```typescript
   const data = await api.getFeature('123')
   ```

#### Add New Page

1. **Create Component:**
   ```typescript
   // src/pages/NewPage.tsx
   export function NewPage() {
     return <div>New Page</div>
   }
   ```

2. **Add to App.tsx:**
   ```typescript
   <ProtectedRoute>
     <NewPage />
   </ProtectedRoute>
   ```

## Authentication Context

### AuthContext Usage

```typescript
import { useAuth } from './contexts/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()
  
  if (!isAuthenticated) {
    return <Login />
  }
  
  return <div>Welcome, {user?.username}</div>
}
```

### AuthContext Methods

- `login(credentials)`: Authenticate user
- `logout()`: Clear authentication
- `refreshAuth()`: Refresh expired tokens

## Styling

### Design Tokens

The portal uses ODE design tokens:

- **Primary Color**: Green (#4F7F4E)
- **Secondary Color**: Gold (#E9B85B)
- **Typography**: Noto Sans
- **Spacing**: Consistent spacing scale

### CSS Structure

- **Global Styles**: `src/index.css`
- **Component Styles**: Component-specific CSS files
- **No Framework**: Plain CSS (can extend with CSS modules)

## Best Practices

### Code Organization

1. **Types First**: Define TypeScript types
2. **API Service**: Centralize API calls
3. **Context for State**: Use Context for global state
4. **Component Separation**: Separate components and pages

### Error Handling

1. **Try-Catch Blocks**: Wrap API calls
2. **User-Friendly Messages**: Show clear error messages
3. **Error Logging**: Log errors for debugging
4. **Graceful Degradation**: Handle errors gracefully

### Performance

1. **Code Splitting**: Lazy load components
2. **Memoization**: Memoize expensive computations
3. **Optimistic Updates**: Update UI before server response
4. **Debouncing**: Debounce search and filter inputs

## Troubleshooting

### Common Issues

**Portal Won't Load:**
- Check backend is running
- Verify API URL configuration
- Check browser console for errors

**Authentication Fails:**
- Verify credentials
- Check JWT_SECRET on server
- Clear localStorage and retry

**API Calls Fail:**
- Check network connectivity
- Verify CORS configuration
- Check server logs

## Related Documentation

- [Synkronus Server Reference](/reference/synkronus-server) - Backend API
- [Deployment Guide](/guides/deployment) - Production deployment
- [Configuration Guide](/guides/configuration) - Configuration options
- [API Reference](/reference/api) - Complete API documentation

