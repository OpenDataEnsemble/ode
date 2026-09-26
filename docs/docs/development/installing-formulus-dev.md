---
sidebar_position: 2
---

# Installing Formulus for Development

Complete guide for developers to install Formulus on physical devices or emulators using ADB or development builds.

## Overview

Developers can install Formulus on Android devices or emulators using several methods:

- **ADB Installation** - Install APK directly via Android Debug Bridge
- **Android Emulator** - Run and test on virtual devices
- **Development Build** - Build and run from source with hot reload

This guide covers cross-platform commands for Linux, macOS, and Windows.

## Prerequisites

Before installing, ensure you have:

| Requirement | Description |
|-------------|-------------|
| **Android SDK** | Android SDK Platform Tools (includes ADB) |
| **ADB** | Android Debug Bridge (part of SDK Platform Tools) |
| **USB Drivers** | Device-specific USB drivers (for physical devices) |
| **Developer Options** | Enabled on Android device (for physical devices) |
| **USB Debugging** | Enabled on Android device (for physical devices) |

### Installing Android SDK Platform Tools

<Tabs>
  <TabItem value="linux" label="Linux">

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install android-tools-adb android-tools-fastboot

# Fedora
sudo dnf install android-tools

# Arch Linux
sudo pacman -S android-tools

# Verify installation
adb version
```

  </TabItem>
  <TabItem value="mac" label="macOS">

```bash
# Using Homebrew
brew install android-platform-tools

# Verify installation
adb version
```

  </TabItem>
  <TabItem value="windows" label="Windows">

1. **Download Android SDK Platform Tools** from [developer.android.com](https://developer.android.com/studio/releases/platform-tools)
2. **Extract the ZIP file** to a location like `C:\platform-tools`
3. **Add to PATH**:
   - Open System Properties → Environment Variables
   - Add `C:\platform-tools` to the PATH variable
4. **Verify installation**:
   ```powershell
   adb version
   ```

  </TabItem>
</Tabs>

## Method 1: ADB Installation on Physical Device

### Step 1: Enable Developer Options

1. **Open Settings** on your Android device
2. **Navigate to About Phone** (or About Device)
3. **Find "Build Number"** (usually at the bottom)
4. **Tap "Build Number" 7 times** until you see "You are now a developer!"

### Step 2: Enable USB Debugging

1. **Go back to Settings**
2. **Open Developer Options** (now visible in Settings)
3. **Enable "USB Debugging"**
4. **Accept the warning** about USB debugging

### Step 3: Connect Device

1. **Connect your device** to your computer via USB cable
2. **On your device**, you may see a prompt: "Allow USB debugging?"
3. **Check "Always allow from this computer"** (optional but recommended)
4. **Tap "Allow"**

### Step 4: Verify Device Connection

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
adb devices
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
adb devices
```

  </TabItem>
</Tabs>

**Expected output:**
```
List of devices attached
ABC123XYZ456    device
```

If you see "unauthorized", check your device and accept the USB debugging prompt.

### Step 5: Install Formulus APK

#### Option A: Install from Local APK File

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Navigate to directory containing APK
cd /path/to/formulus/android/app/build/outputs/apk/debug

# Install APK
adb install app-debug.apk
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
# Navigate to directory containing APK
cd C:\path\to\formulus\android\app\build\outputs\apk\debug

# Install APK
adb install app-debug.apk
```

  </TabItem>
</Tabs>

#### Option B: Install from Remote URL

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Browse the release and download the arm64-v8a APK for most phones:
# https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.2
# Asset names look like: formulus-v1.3.2-64-universal-release-YYYYMMDD.apk
adb install /path/to/formulus-v1.3.2-*-universal-release-*.apk
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
# Browse the release and download the arm64-v8a APK for most phones:
# https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.2
# Asset names look like: formulus-v1.3.2-64-universal-release-YYYYMMDD.apk
adb install "C:\path\to\formulus-v1.3.2-*-universal-release-*.apk"
```

  </TabItem>
</Tabs>

### Step 6: Verify Installation

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Check if app is installed
adb shell pm list packages | grep formulus

# Launch the app
adb shell am start -n com.opendataensemble.formulus/.MainActivity
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
# Check if app is installed
adb shell pm list packages | Select-String formulus

# Launch the app
adb shell am start -n com.opendataensemble.formulus/.MainActivity
```

  </TabItem>
</Tabs>

## Method 2: Android Emulator Installation

### Step 1: Set Up Android Emulator

#### Using Android Studio

1. **Install Android Studio** from [developer.android.com](https://developer.android.com/studio)
2. **Open Android Studio** → **Tools** → **Device Manager**
3. **Create Virtual Device** → Select a device (e.g., Pixel 5)
4. **Select System Image** (e.g., Android 11, API 30)
5. **Finish** and start the emulator

#### Using Command Line (Linux/macOS)

```bash
# Install emulator via SDK Manager
sdkmanager "emulator" "platform-tools" "platforms;android-30"

# List available system images
sdkmanager --list | grep system-images

# Create AVD (Android Virtual Device)
avdmanager create avd -n formulus_emulator -k "system-images;android-30;google_apis;x86_64"

# Start emulator
emulator -avd formulus_emulator &
```

### Step 2: Verify Emulator Connection

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Wait for emulator to boot (may take 1-2 minutes)
adb devices

# Should show emulator
List of devices attached
emulator-5554    device
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
adb devices
```

  </TabItem>
</Tabs>

### Step 3: Install Formulus on Emulator

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Build APK first (if not already built)
cd formulus
pnpm run android

# Install on emulator
adb -s emulator-5554 install android/app/build/outputs/apk/debug/app-debug.apk
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
# Build APK first
cd formulus
pnpm run android

# Install on emulator
adb -s emulator-5554 install android\app\build\outputs\apk\debug\app-debug.apk
```

  </TabItem>
</Tabs>

### Step 4: Important Notes for Emulator

When configuring Formulus on an emulator to connect to a local server:

- **Use `10.0.2.2` instead of `localhost`** - This is the special IP that the emulator uses to access the host machine
- **Example server URL**: `http://10.0.2.2:8080`
- **For network servers**: Use the actual IP address or domain name

## Method 3: Development Build with Hot Reload

### Prerequisites

- **Node.js** 20+ and **pnpm** 10.33.2
- **React Native CLI** or **Expo CLI**
- **Java Development Kit (JDK)** 11 or higher
- **Android Studio** with Android SDK

### Step 1: Install Dependencies

<Tabs>
  <TabItem value="all" label="All Platforms">

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus
pnpm install
```

  </TabItem>
</Tabs>

### Step 2: Start Metro Bundler

<Tabs>
  <TabItem value="all" label="All Platforms">

```bash
# In formulus directory
pnpm start
```

Keep this terminal open. Metro is the JavaScript bundler for React Native.

  </TabItem>
</Tabs>

### Step 3: Build and Run on Device/Emulator

<Tabs>
  <TabItem value="all" label="All Platforms">

```bash
# For Android device (connected via USB)
pnpm run android

# For Android emulator (must be running)
pnpm run android
```

  </TabItem>
</Tabs>

This command will:
1. Build the Android app
2. Install it on your device/emulator
3. Start the app
4. Connect to Metro bundler for hot reload

### Step 4: Development Features

With development build, you get:

- **Hot Reload** - Changes reflect immediately
- **Fast Refresh** - React components update without losing state
- **Debug Menu** - Shake device or press `Ctrl+M` (Windows/Linux) or `Cmd+M` (macOS)
- **React Native Debugger** - Debug JavaScript code in Chrome DevTools

## Common ADB Commands

### Useful Commands for Development

**List connected devices:**
```bash
adb devices
```

**Install APK:**
```bash
adb install path/to/app.apk
```

**Uninstall app:**
```bash
adb uninstall com.opendataensemble.formulus
```

**Reinstall app (uninstall + install):**
```bash
adb install -r path/to/app.apk
```

**View app logs:**
```bash
# All logs
adb logcat

# Filter for Formulus only
adb logcat | grep -i formulus

# Clear logs
adb logcat -c
```

**Pull file from device:**
```bash
adb pull /path/on/device /path/on/computer
```

**Push file to device:**
```bash
adb push /path/on/computer /path/on/device
```

**Open app:**
```bash
adb shell am start -n com.opendataensemble.formulus/.MainActivity
```

**Stop app:**
```bash
adb shell am force-stop com.opendataensemble.formulus
```

**Clear app data:**
```bash
adb shell pm clear com.opendataensemble.formulus
```

## Troubleshooting

### Device Not Detected

**Problem**: `adb devices` shows no devices.

**Solutions**:
- Check USB cable connection
- Try a different USB port
- Install device-specific USB drivers (Windows)
- Enable USB debugging on device
- Accept USB debugging prompt on device
- Restart ADB server: `adb kill-server && adb start-server`

### Installation Fails

**Problem**: `adb install` fails with error.

**Solutions**:
- Uninstall existing version first: `adb uninstall com.opendataensemble.formulus`
- Use `-r` flag to reinstall: `adb install -r app.apk`
- Check device has enough storage
- Verify APK is not corrupted
- Check device is in file transfer mode (not charging only)

### Emulator Connection Issues

**Problem**: Cannot connect to local server from emulator.

**Solutions**:
- Use `10.0.2.2` instead of `localhost` for server URL
- Check firewall isn't blocking connections
- Verify server is running and accessible
- Use actual IP address instead of localhost

### Permission Denied Errors

**Problem**: ADB commands fail with permission errors.

<Tabs>
  <TabItem value="linux" label="Linux">

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Create udev rules
sudo nano /etc/udev/rules.d/51-android.rules
# Add: SUBSYSTEM=="usb", ATTR{idVendor}=="####", MODE="0664", GROUP="plugdev"

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Log out and log back in
```

  </TabItem>
  <TabItem value="mac" label="macOS">

macOS typically doesn't require special permissions for ADB. If you encounter permission issues:

1. Check USB cable connection
2. Try a different USB port
3. Restart ADB: `adb kill-server && adb start-server`
4. Check System Preferences → Security & Privacy for blocked apps

  </TabItem>
  <TabItem value="windows" label="Windows">

Windows typically handles USB device permissions automatically. If you encounter issues:

1. Install device-specific USB drivers from manufacturer
2. Check Device Manager for unrecognized devices
3. Try different USB port or cable
4. Restart ADB: `adb kill-server && adb start-server`

  </TabItem>
</Tabs>

## Related Documentation

- [Formulus Development Setup](/docs/development/formulus-development) - Complete development environment setup
- [Formulus Component Reference](/docs/reference/formulus) - Detailed component documentation
- [Building and Testing](/docs/development/building-testing) - Build and test procedures

