---
sidebar_position: 2
---

# Installing Formulus App

Complete guide for installing the Formulus mobile application on Android and iOS devices. For the current links, see [Downloads](/downloads).

## Overview

Formulus is available for Android and iOS. Choose the method that best fits your device:

- **F-Droid** (recommended for Android) - Install Formulus directly from [F-Droid](https://f-droid.org/en/packages/org.opendataensemble.formulus/)
- **Obtainium** (Android) - Installs Formulus from GitHub releases with automatic updates.
- **Direct APK** (Android) - Download the current APK from [Downloads](/downloads) or [GitHub releases](https://github.com/OpenDataEnsemble/ode/releases).
- **App Store** (iPhone/iPad) - Install Formulus from the [Apple App Store](https://apps.apple.com/dk/app/formulus/id6798318215).
- **Development Build** - For developers who want to build from source

## System Requirements

Before installing, ensure your device meets these requirements:

| Requirement | Minimum |
|-------------|---------|
| **Android Version** | Android 7.0 (API level 24) or higher |
| **iOS Version** | iOS 15.1 or higher |
| **Storage Space** | 50 MB free space |
| **Internet Connection** | Required for initial setup and synchronization |
| **Permissions** | Camera, Storage, Location (for form features) |

## Installation Methods

### Method 1: Obtainium (Recommended)

Obtainium is the recommended method for installing Formulus. It allows you to install and update Formulus directly from GitHub releases, including pre-release versions. You can install Obtainium via F-Droid or by downloading it directly.

#### Step 1: Install Obtainium

You have two options to install Obtainium:

##### Option A: Install Obtainium via F-Droid (Recommended)

1. **Open your web browser** and navigate to [f-droid.org](https://f-droid.org/)
2. **Locate the "DOWNLOAD F-DROID" button** on the main page
3. **Tap the "DOWNLOAD F-DROID" button** to download the F-Droid APK file
4. **Enable installation from unknown sources**:
   - Go to **Settings** → **Security** → **Unknown Sources** (or **Apps** → **Special app access** → **Install unknown apps** on newer Android versions)
   - Select your browser (Chrome, Firefox, etc.) from the list
   - **Enable "Allow from this source"** toggle switch
   - Read and acknowledge the security warning about installing apps from unknown sources
5. **Return to your browser** and open the downloaded F-Droid APK file
6. **Tap "Install"** when prompted
7. **Wait for installation** to complete, then tap **"Open"** to launch F-Droid

![F-Droid Download Page](/img/installation/f-droid-download.png)

8. **Open F-Droid** and search for "Obtainium"
9. **Tap on Obtainium** in the search results
10. **Tap "Install"** to install Obtainium
11. **Wait for installation** to complete

##### Option B: Install Obtainium Directly from GitHub

1. **Download Obtainium** from the [Obtainium releases page](https://github.com/ImranR98/Obtainium/releases)
2. **Enable installation from unknown sources**:
   - Go to **Settings** → **Security** → **Unknown Sources** (or **Apps** → **Special app access** → **Install unknown apps** on newer Android versions)
   - Select your browser from the list
   - **Enable "Allow from this source"** toggle switch
   - Acknowledge the security warning
3. **Install Obtainium** by opening the downloaded APK file
4. **Tap "Install"** when prompted in the installation confirmation dialog
5. **Wait for installation** to complete

![Obtainium Installation](/img/installation/obtainium-install.png)

#### Step 2: Add ODE Repository to Obtainium

1. **Open Obtainium** on your device
2. **Navigate to the "Add app" tab** in the bottom navigation bar (indicated by a "+" icon)
3. **Enter the GitHub repository URL** in the "App source URL" field:
   - The field should contain: `https://github.com/OpenDataEnsemble/ode`
   - Ensure the full URL is entered correctly
4. **Configure GitHub options** (for pre-release testing only):
   - **Enable "Include prereleases"** if you need alpha/beta builds
   - **Enable "Fallback to older releases"** if newer releases are unavailable
5. **Tap the "Add" button** to save the repository
6. **Wait for Obtainium to fetch** the repository information and available releases

![Obtainium Add App Screen](/img/installation/obtainium-add-app.png)

**Stable release:** Install **v1.3.2** (or the latest [GitHub release](https://github.com/OpenDataEnsemble/ode/releases)). Pre-release toggles are only needed for alpha/beta testing.

#### Step 3: Install Formulus

1. **Open Obtainium** and navigate to the **"Apps"** tab
2. **Find "ode"** in your apps list (it should appear after adding the repository)
3. **Tap on "ode"** to open the app details page
4. **Review the app information**:
   - App name: **ode**
   - Developer: **OpenDataEnsemble**
   - Package: `org.opendataensemble.formulus`
   - Latest version: **v1.3.2** (or current [release](https://github.com/OpenDataEnsemble/ode/releases))
   - Status: **Not installed**
5. **Tap the "Install" button** at the bottom of the screen
6. **Confirm installation** when prompted:
   - A dialog will appear showing the **Formulus** app icon and asking "Do you want to install this app?"
   - **Tap "Install"** in the confirmation dialog (the "Cancel" button is on the left)
7. **Wait for download and installation** to complete
8. **Find Formulus** in your app drawer or search for it:
   - Open your app drawer or launcher
   - Search for "Formulus" or "formulu"
   - The app icon shows a yellow giraffe head with a green background and white clipboard
   - **Tap on Formulus** to launch the app

![ODE App Details in Obtainium](/img/installation/obtainium-ode-details.png)

![Formulus Installation Dialog](/img/installation/formulus-install-dialog.png)

![Formulus App Search](/img/installation/formulus-app-search.png)

#### Automatic Updates

Obtainium will automatically check for updates:

1. **Open Obtainium** and navigate to the **"Apps"** tab
2. **Apps with available updates** will be marked
3. **Tap on "ode"** to see update details
4. **Tap "Update"** or **"Install"** to install the new version
5. **Confirm the update** when prompted
6. **App data is preserved** during update

### Method 2: F-Droid (recommended for Android)

Install Formulus directly from F-Droid (no Obtainium required):

1. Install the [F-Droid](https://f-droid.org/) client if you do not already have it
2. Open F-Droid and search for **Formulus** (package `org.opendataensemble.formulus`)
3. Tap **Install** and wait for the download to complete
4. Updates are available through F-Droid when a new version is published

### Method 3: Direct APK Installation (Android)

If Obtainium is not available or you prefer direct installation:

#### Step 1: Download the APK

1. **Download the latest APK** from [Downloads](/downloads) or the [releases page](https://github.com/OpenDataEnsemble/ode/releases)
2. **Save the file** to your device's Downloads folder

#### Step 2: Enable Unknown Sources

1. **Go to Settings** → **Security** (or **Apps** → **Special app access** → **Install unknown apps** on newer Android versions)
2. **Select your browser or file manager** from the list (e.g., Chrome, Firefox, Files)
3. **Enable "Allow from this source"** toggle switch
4. **Read and acknowledge** the security warning:
   > "Your phone and personal data are more vulnerable to attack by unknown apps. By installing apps from this source, you agree that you are responsible for any damage to your phone or loss of data that may result from their use."

![Enable Unknown Sources](/img/installation/enable-unknown-sources.png)

#### Step 3: Install the APK

1. **Open your file manager** or Downloads app
2. **Navigate to the Downloads folder**
3. **Tap on the Formulus APK file**
4. **Review the permissions** requested by the app
5. **Tap "Install"** to begin installation
6. **Wait for installation** to complete
7. **Tap "Open"** to launch the app

### Method 4: App Store (iPhone and iPad)

1. Open the [Formulus App Store page](https://apps.apple.com/dk/app/formulus/id6798318215) on your iPhone or iPad.
2. Tap **Get**, then authenticate with Face ID, Touch ID, or your Apple ID.
3. Wait for Formulus to install, then open it from your home screen.

### Method 5: Development Build

For developers who want to build and install from source, see the [Development Installation Guide](/docs/development/formulus-development).

## Post-Installation Setup

After installing Formulus, you need to configure it to connect to your Synkronus server:

### Initial Configuration

1. **Open Formulus** on your device
2. **You'll see the welcome screen** with configuration options
3. **Choose your configuration method**:
   - **QR Code Scan** (Recommended) - Scan a QR code with server details
   - **Manual Entry** - Enter server URL and credentials manually

### QR Code Configuration

1. **Tap "Scan QR Code"** on the welcome screen
2. **Grant camera permission** if prompted
3. **Point the camera** at the QR code provided by your administrator
4. **Settings auto-populate** with server URL, username, and password
5. **Tap "Connect"** to verify and save the configuration

### Manual Configuration

1. **Tap "Manual Configuration"** on the welcome screen
2. **Enter Server URL**: `http://your-server-ip:8080` or `https://your-server-domain`
3. **Enter Username**: Your username provided by your administrator
4. **Enter Password**: Your password
5. **Tap "Test Connection"** to verify connectivity
6. **Tap "Save"** to store the configuration

### First Login

1. **After configuration**, you'll be prompted to log in
2. **Credentials should be pre-filled** (if using QR code)
3. **Tap "Login"** to authenticate
4. **Wait for authentication** - A token is stored locally for future sessions
5. **You'll be redirected** to the main app interface

## Verification

To verify that Formulus is installed correctly:

1. **Check app icon** appears in your app drawer
2. **Open the app** and verify it launches without errors
3. **Check Settings** to confirm server configuration is saved
4. **Test connection** by tapping "Test Connection" in Settings
5. **Verify login** by logging in with your credentials

## Troubleshooting Installation

### Installation Fails

**Problem**: APK installation fails with "App not installed" error.

**Solutions**:
- Ensure you have enough storage space (at least 50 MB free)
- Check that "Unknown Sources" is enabled for your file manager
- Try downloading the APK again (file may be corrupted)
- Ensure your device meets minimum Android version requirements (7.0+)

### App Crashes on Launch

**Problem**: Formulus crashes immediately after opening.

**Solutions**:
- Restart your device
- Clear app data: Settings → Apps → Formulus → Storage → Clear Data
- Uninstall and reinstall the app
- Check that your device has sufficient RAM available

### Cannot Connect to Server

**Problem**: App cannot connect to the Synkronus server.

**Solutions**:
- Verify server URL is correct (check for typos)
- Ensure device has internet connection
- Check that server is running and accessible
- Verify firewall settings aren't blocking the connection
- For local development, use `10.0.2.2` instead of `localhost` on Android emulator

### Obtainium Not Finding Updates

**Problem**: Obtainium doesn't show Formulus updates.

**Solutions**:
- Ensure the ODE repository is added correctly in Obtainium
- Check that "Include prereleases" is enabled if you want pre-release versions
- Refresh Obtainium: Open the app and wait for it to check for updates
- Check that Obtainium has internet connection
- Verify repository URL is correct: `https://github.com/OpenDataEnsemble/ode`

## Updating Formulus

### Via Obtainium

1. **Open Obtainium** and navigate to the **"Apps"** tab
2. **Find "ode"** in your apps list
3. **Tap on "ode"** to see update information
4. **Tap "Install"** or **"Update"** if a newer version is available
5. **Confirm the installation** when prompted
6. **App data is preserved** during update

### Via Direct APK

1. **Download the latest APK** from [Downloads](/downloads) or the [releases page](https://github.com/OpenDataEnsemble/ode/releases)
2. **Install over existing installation** (no need to uninstall)
3. **App data is preserved** during update

## Uninstalling Formulus

To uninstall Formulus:

1. **Go to Settings** → **Apps** (or **Application Manager**)
2. **Find Formulus** in the app list
3. **Tap on Formulus**
4. **Tap "Uninstall"**
5. **Confirm uninstallation**

**Note**: Uninstalling will remove all local data, including:
- Saved observations (not yet synced)
- App configuration
- Cached app bundles
- Local database

**Important**: Ensure all data is synced to the server before uninstalling.

## Finding Formulus After Installation

After installation, you can find and launch Formulus:

1. **Open your app drawer** or launcher
2. **Search for "Formulus"** or "formulu" using your device's search function
3. **Look for the Formulus icon**: A yellow giraffe head with a green background and white clipboard with checkmarks
4. **Tap on the Formulus icon** to launch the app

![Finding Formulus App](/img/installation/formulus-app-search.png)

## Related Documentation

- [Formulus Features](/docs/using/formulus-features) - Learn about app features and usage
- [Your First Form](/docs/using/your-first-form) - Get started with data collection
- [Synchronization](/docs/using/synchronization) - Understand how data syncs work
- [Development Installation](/docs/development/formulus-development) - For developers building from source
