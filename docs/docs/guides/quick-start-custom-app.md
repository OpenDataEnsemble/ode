---
sidebar_position: 1
---

# Quick Start: Build Your First Custom App

Create and deploy a custom ODE application in 30 minutes using this step-by-step guide.

## What You'll Need

**Prerequisites:**
- ODE server running (see [Installation Guide](/docs/getting-started/installation))
- Node.js 20+ and npm 10+ (for **your custom app** project; the ODE monorepo uses **pnpm** — see [Development Setup](/docs/development/setup#package-manager-pnpm))
- Basic knowledge of React/JavaScript
- Text editor (VS Code recommended)

**Final Result:**
- A working custom app with 1 form
- Deployed to your ODE server
- Testable on mobile device

---

## Step 1: Create Project Structure

Create these exact folders and files:

```
my-app/
├── app/
│   ├── public/
│   │   └── app.config.json      # App configuration
│   ├── src/
│   │   ├── App.js               # Main app component
│   │   ├── theme.js             # Theme generation
│   │   └── index.js             # App entry point
│   ├── package.json             # Dependencies
│   └── vite.config.js           # Build configuration
└── forms/
    └── survey/
        ├── schema.json          # Form data structure
        └── ui.json              # Form layout
```

---

## Step 2: Create App Configuration

**File:** `app/public/app.config.json`

```json
{
  "name": "My First App",
  "version": "1.0.0",
  "navigation": {
    "tabs": ["Home", "Forms", "Sync"]
  },
  "theme": {
    "light": {
      "primary": "#1976d2",
      "primaryLight": "#42a5f5",
      "primaryDark": "#1565c0",
      "onPrimary": "#ffffff",
      "background": "#fafafa",
      "surface": "#ffffff",
      "onBackground": "#212121",
      "onSurface": "#424242",
      "divider": "#e0e0e0"
    }
  }
}
```

---

## Step 3: Create Package.json

**File:** `app/package.json`

```json
{
  "name": "my-first-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "zip": "node scripts/build-zip.js",
    "copy-forms": "node scripts/copy-forms.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.1",
    "@mui/material": "^5.16.0",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.5.1",
    "adm-zip": "^0.5.9"
  }
}
```

---

## Step 4: Create Vite Configuration

**File:** `app/vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../app-bundles/app',
    emptyOutDir: true,
    assetsDir: 'assets'
  }
});
```

---

## Step 5: Create Theme System

**File:** `app/src/theme.js`

```javascript
import { createTheme } from '@mui/material/styles';
import appConfig from '../public/app.config.json';

export function buildTheme(mode = 'light') {
  const colors = appConfig.theme[mode] ?? appConfig.theme.light;
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: colors.primaryLight,
        dark: colors.primaryDark,
        contrastText: colors.onPrimary,
      },
      background: {
        default: colors.background,
        paper: colors.surface,
      },
      text: {
        primary: colors.onBackground,
        secondary: colors.onSurface,
      },
      divider: colors.divider,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      button: { textTransform: 'none' },
    },
    shape: {
      borderRadius: 8,
    },
  });
}

const theme = buildTheme('light');
export default theme;
```

---

## Step 6: Create Main App Component

**File:** `app/src/App.js`

```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import theme from './theme';
import Home from './Home';
import Forms from './Forms';
import Sync from './Sync';

// Use HashRouter for compatibility with Formulus
const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/forms", element: <Forms /> },
  { path: "/sync", element: <Sync /> },
]);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
```

---

## Step 7: Create Screen Components

**File:** `app/src/Home.js`

```javascript
import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';

function Home() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My First App
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome to your first ODE custom application!
        </Typography>
        <Button variant="contained" href="#/forms">
          Start Survey
        </Button>
      </Box>
    </Container>
  );
}

export default Home;
```

**File:** `app/src/Forms.js`

```javascript
import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';

function Forms() {
  const openSurvey = () => {
    // This will be handled by Formulus when running in the mobile app
    if (window.formulus) {
      window.formulus.openForm('survey', { mode: 'create' });
    } else {
      alert('Form opening only works in Formulus mobile app');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Forms
        </Typography>
        <Typography variant="body1" paragraph>
          Available forms for data collection.
        </Typography>
        <Button variant="contained" onClick={openSurvey} sx={{ mr: 2 }}>
          New Survey
        </Button>
        <Button variant="outlined" href="#/">
          Back to Home
        </Button>
      </Box>
    </Container>
  );
}

export default Forms;
```

**File:** `app/src/Sync.js`

```javascript
import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';

function Sync() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Sync
        </Typography>
        <Typography variant="body1" paragraph>
          Synchronization status and controls.
        </Typography>
        <Button variant="outlined" href="#/">
          Back to Home
        </Button>
      </Box>
    </Container>
  );
}

export default Sync;
```

---

## Step 8: Create App Entry Point

**File:** `app/src/index.js`

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Step 9: Create Your First Form

**File:** `forms/survey/schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Simple Survey",
  "properties": {
    "name": {
      "type": "string",
      "title": "Full Name",
      "minLength": 2
    },
    "email": {
      "type": "string",
      "title": "Email Address",
      "format": "email"
    },
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 1,
      "maximum": 120
    },
    "satisfaction": {
      "type": "string",
      "title": "Satisfaction Level",
      "enum": ["very-satisfied", "satisfied", "neutral", "dissatisfied", "very-dissatisfied"]
    }
  },
  "required": ["name", "email", "age"]
}
```

**File:** `forms/survey/ui.json`

```json
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/name"
    },
    {
      "type": "Control",
      "scope": "#/properties/email"
    },
    {
      "type": "Control",
      "scope": "#/properties/age"
    },
    {
      "type": "Control",
      "scope": "#/properties/satisfaction"
    }
  ]
}
```

---

## Step 10: Create Build Scripts

**Create folder:** `app/scripts/`

**File:** `app/scripts/copy-forms.js`

```javascript
import fs from 'fs-extra';
import path from 'path';

const sourceDir = path.join(process.cwd(), '..', 'forms');
const targetDir = path.join(process.cwd(), 'public', 'forms');

fs.copy(sourceDir, targetDir)
  .then(() => console.log('✓ Forms copied successfully'))
  .catch(err => console.error('✗ Error copying forms:', err));
```

**File:** `app/scripts/build-zip.js`

```javascript
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const appBundleDir = path.resolve(__dirname, '../../app-bundles');
const appOutDir = path.resolve(__dirname, '../..', 'app-bundles', 'app');
const formsSrcDir = path.resolve(__dirname, '../../forms');
const version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version;
const zipName = `bundle-v${version}.zip`;
const zipPath = path.join(appBundleDir, zipName);

function buildZip() {
  console.log('📦 Building app bundle ZIP...\n');
  
  const tempDir = fs.mkdtempSync(path.join(appBundleDir, 'tmp-'));
  const tempAppDir = path.join(tempDir, 'app');
  fs.mkdirSync(tempAppDir, { recursive: true });
  
  try {
    // Copy forms to app/forms/
    const formsDest = path.join(tempAppDir, 'forms');
    fs.mkdirSync(formsDest, { recursive: true });
    
    if (fs.existsSync(formsSrcDir)) {
      fs.copySync(formsSrcDir, formsDest);
      console.log('✓ Forms copied to app/forms/');
    }
    
    // Copy built app files
    if (fs.existsSync(appOutDir)) {
      fs.copySync(appOutDir, tempAppDir);
      console.log('✓ App files copied to app/');
    }
    
    // Create ZIP
    const zip = new AdmZip();
    
    function addDirectoryToZip(dirPath, zipPathPrefix) {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        const zipEntryPath = path.join(zipPathPrefix, item).replace(/\\/g, '/');
        
        if (stat.isDirectory()) {
          addDirectoryToZip(fullPath, zipEntryPath);
        } else {
          zip.addFile(zipEntryPath, fs.readFileSync(fullPath));
        }
      }
    }
    
    addDirectoryToZip(tempAppDir, 'app');
    zip.writeZip(zipPath);
    
    const stats = fs.statSync(zipPath);
    console.log(`\n✅ Bundle created: ${zipPath}`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

buildZip();
```

---

## Step 11: Build and Deploy

### 11.1 Install Dependencies

```bash
cd app
npm install
```

### 11.2 Build Your App

```bash
# Copy forms and build the app
npm run copy-forms
npm run build

# Create deployment bundle
npm run zip
```

**Expected Output:**
```
✓ Forms copied successfully
✓ App files copied to app/

📦 Building app bundle ZIP...
✓ Forms copied to app/forms/
✓ App files copied to app/

✅ Bundle created: /path/to/my-app/app-bundles/bundle-v1.0.0.zip
📊 Size: 45.23 KB
```

### 11.3 Deploy to ODE Server

**Option A: Via CLI (Recommended)**

```bash
# Install Synkronus CLI (if not already installed)
go install github.com/OpenDataEnsemble/ode/synkronus-cli/cmd/synkronus@latest

# Login to your server
synk login --url http://localhost:8080 --username admin

# Upload and activate your app
synk app-bundle upload app-bundles/bundle-v1.0.0.zip --activate
```

**Option B: Via Web Portal**

1. Open browser: `http://localhost:8080/portal`
2. Login with admin credentials
3. Navigate to "App Bundles"
4. Click "Upload Bundle"
5. Select: `app-bundles/bundle-v1.0.0.zip`
6. Click "Upload" then "Activate"

---

## Step 12: Test on Mobile Device

### 12.1 Install Formulus App

**Android (build Formulus from the ODE repo):**
```bash
cd ode/packages/tokens && pnpm install && pnpm run build && cd ../..
cd ode/formulus && pnpm install && pnpm run android
```

Or install a release APK / from an app store when available.

### 12.2 Configure App

1. Open Formulus app
2. Enter server URL: `http://your-server-ip:8080`
3. Login with your credentials
4. Wait for initial sync

### 12.3 Test Your Custom App

1. In Formulus, tap "Custom Apps"
2. Select "My First App"
3. Navigate to "Forms" tab
4. Tap "New Survey"
5. Fill out the form and submit
6. Check "Sync" to upload data

---

## 🎉 Congratulations!

You've successfully:
- ✅ Created a custom ODE application
- ✅ Built and packaged it for deployment
- ✅ Deployed it to your ODE server
- ✅ Tested it on a mobile device

## Next Steps

- **Add more forms**: Create additional form folders in `forms/`
- **Customize theme**: Modify colors in `app.config.json`
- **Add features**: Extend React components in `src/`
- **Update version**: Change version in `package.json` and rebuild

## Troubleshooting

**Build fails:**
- Ensure all dependencies installed: `npm install`
- Check forms folder exists and contains valid JSON

**Upload fails:**
- Verify server is running: `http://localhost:8080`
- Check admin credentials are correct
- Ensure bundle file exists and is not corrupted

**App not showing on mobile:**
- Check server URL in Formulus app
- Verify bundle was activated successfully
- Wait for sync to complete (pull to refresh)

**Form not opening:**
- Ensure form files are valid JSON
- Check form name matches in `openForm()` call
- Verify form exists in `forms/` directory
