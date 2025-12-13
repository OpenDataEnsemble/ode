# synkronus-portal – LLM Context for Frontend Development

This file explains the architecture and patterns of the **synkronus-portal** project so future LLM agents can extend the frontend without re-analyzing the codebase.

## High-Level Architecture

- **Entry point**: `src/main.tsx`
  - Renders the root `App` component with `React.StrictMode`.
- **App structure**: `src/App.tsx`
  - Wraps the application with `AuthProvider` for authentication state management.
  - Uses `ProtectedRoute` to guard authenticated pages.
- **Build tool**: Vite with React plugin
  - Development server with HMR (Hot Module Replacement).
  - Production builds output to `dist/` directory.
- **Tech stack**:
  - React 19.2.0 with TypeScript
  - Vite 7.2.4 for build tooling
  - No routing library (simple conditional rendering based on auth state)

## Project Structure

```
src/
├── main.tsx              # Application entry point
├── App.tsx               # Root component with AuthProvider
├── App.css               # App-specific styles
├── index.css             # Global styles and CSS reset
├── types/
│   └── auth.ts          # TypeScript interfaces for authentication
├── services/
│   └── api.ts           # HTTP client for API requests
├── contexts/
│   └── AuthContext.tsx  # Authentication state management
├── components/
│   ├── Login.tsx        # Login page component
│   ├── Login.css        # Login page styles
│   └── ProtectedRoute.tsx # Route protection wrapper
└── pages/
    ├── Dashboard.tsx     # Main dashboard page (protected)
    └── Dashboard.css    # Dashboard styles
```

## Authentication System

### AuthContext (`src/contexts/AuthContext.tsx`)

The authentication system is built around React Context:

- **State management**: Stores `user`, `token`, `refreshToken`, and `isAuthenticated` in state.
- **Persistence**: Tokens are stored in `localStorage` and automatically loaded on app mount.
- **Methods**:
  - `login(credentials)` - Authenticates user and stores tokens
  - `logout()` - Clears all auth state and tokens
  - `refreshAuth()` - Refreshes expired tokens automatically

### API Service (`src/services/api.ts`)

Centralized HTTP client for all API requests:

- **Base URL**: Uses `/api` prefix (proxied to backend in development, or `VITE_API_URL` env var).
- **Automatic token injection**: Adds `Authorization: Bearer <token>` header to authenticated requests.
- **Error handling**: Parses API error responses (`{ error: "...", message: "..." }`) and throws meaningful errors.
- **Methods**:
  - `api.login()` - POST `/auth/login`
  - `api.refreshToken()` - POST `/auth/refresh`
  - `api.get()`, `api.post()`, `api.put()`, `api.delete()` - Generic HTTP methods

### Protected Routes

`ProtectedRoute` component:
- Checks `isAuthenticated` from `AuthContext`.
- Automatically refreshes tokens if they expire soon (< 5 minutes).
- Redirects to login if not authenticated.
- Renders children if authenticated.

## Pattern: Adding a New API Endpoint

When adding a new feature that calls the Synkronus API:

1. **Add TypeScript types** (if needed) in `src/types/`:
   ```typescript
   // src/types/feature.ts
   export interface FeatureRequest {
     field: string
   }
   
   export interface FeatureResponse {
     result: string
   }
   ```

2. **Add API method** in `src/services/api.ts`:
   ```typescript
   async getFeature(id: string): Promise<FeatureResponse> {
     return this.get<FeatureResponse>(`/feature/${id}`)
   }
   ```

3. **Use in component**:
   ```typescript
   import { api } from '../services/api'
   
   const data = await api.getFeature('123')
   ```

## Pattern: Adding a New Page/Component

1. **Create component file** in `src/pages/` or `src/components/`:
   ```typescript
   // src/pages/NewPage.tsx
   import { useAuth } from '../contexts/AuthContext'
   import './NewPage.css'
   
   export function NewPage() {
     const { user } = useAuth()
     return <div>New Page Content</div>
   }
   ```

2. **Create CSS file** (if needed):
   ```css
   /* src/pages/NewPage.css */
   .new-page {
     padding: 20px;
   }
   ```

3. **Add to App.tsx** (if it's a protected route):
   ```typescript
   import { NewPage } from './pages/NewPage'
   
   <ProtectedRoute>
     <NewPage />
   </ProtectedRoute>
   ```

## Pattern: Using Authentication

Any component can access auth state via the `useAuth()` hook:

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Not logged in</div>
  }
  
  return (
    <div>
      <p>Welcome, {user?.username}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## API Configuration

### Development (Vite Proxy)

The `vite.config.ts` proxies `/api/*` requests to the backend:
- **Docker**: `http://synkronus:8080` (service name)
- **Local**: `http://localhost:8080`

The proxy automatically rewrites `/api/auth/login` → `/auth/login` before forwarding.

### Production (Nginx)

The `Dockerfile` includes nginx configuration that:
- Serves the built React app from `/usr/share/nginx/html`
- Proxies `/api/*` requests to `http://synkronus:8080` (Docker service name)

### Environment Variables

- `VITE_API_URL`: Override API base URL (bypasses proxy)
  - Example: `VITE_API_URL=http://localhost:8080`
  - If not set, uses `/api` proxy in development

## Docker Setup

### Development Mode (`docker-compose.dev.yml`)

- **Frontend**: Runs `npm run dev` with hot reload
- **Backend**: Built from `../synkronus`
- **Database**: PostgreSQL with auto-initialization script

### Production Mode (`docker-compose.yml`)

- **Frontend**: Built and served via nginx (port 80, exposed as 5173)
- **Backend**: Built from `../synkronus` (port 8080)
- **Database**: PostgreSQL with persistent volumes

### Database Initialization

The `init-db.sh` script:
- Creates `synkronus_user` with password `dev_password_change_in_production`
- Grants all privileges on the `synkronus` database
- Runs automatically on first database initialization

## Error Handling

The API service handles errors consistently:

1. **Network errors**: Shows "Network error: Unable to connect to the server"
2. **401 Unauthorized**: Shows "Invalid username or password" (or API error message)
3. **500+ errors**: Shows "Server error: Please check if the API is running"
4. **API errors**: Parses `{ error: "...", message: "..." }` format from backend

Components should catch errors and display them to users:

```typescript
try {
  await api.someMethod()
} catch (error) {
  setError(error instanceof Error ? error.message : 'An error occurred')
}
```

## Styling Patterns

- **Global styles**: `src/index.css` - CSS reset and base styles
- **Component styles**: Each component has its own `.css` file
- **No CSS framework**: Uses plain CSS (can be extended with CSS modules or styled-components if needed)

## TypeScript Configuration

- **Strict mode**: Enabled in `tsconfig.json`
- **Path aliases**: Not currently configured (use relative imports)
- **Type definitions**: All API types in `src/types/`

## Checklist for Adding a New Feature

When extending the portal, LLM agents should:

1. **Define TypeScript types** (if needed)
   - Add interfaces in `src/types/` for request/response types

2. **Add API methods** (if calling backend)
   - Extend `src/services/api.ts` with new methods
   - Use existing patterns for error handling

3. **Create components/pages**
   - Place in `src/components/` or `src/pages/`
   - Use `useAuth()` hook if authentication is needed
   - Add CSS file for styling

4. **Update App.tsx** (if adding a new route)
   - Wrap with `ProtectedRoute` if authentication required
   - Import and render the new component

5. **Test error handling**
   - Ensure network errors are handled gracefully
   - Show user-friendly error messages

6. **Update README** (optional)
   - Document new features or endpoints

Following this guide should allow LLM agents to add new features that are consistent with the existing synkronus-portal architecture and patterns.

