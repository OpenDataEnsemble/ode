---
sidebar_position: 3
---

# Formulus Development

Complete guide for developing the Formulus mobile application.

## Overview

This guide covers local development and production building for the Formulus React Native application.

## Prerequisites

### Required Tools

- **Node.js** 20+ and **pnpm** 10.33.2 (see [Development Setup](/docs/development/setup#package-manager-pnpm))
- **React Native CLI** or Expo CLI
- **Java Development Kit (JDK)** 11 or higher
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Android SDK** (via Android Studio)
- **CocoaPods** (for iOS, macOS only)

### Platform-Specific Requirements

#### Android

- Android SDK Platform 33+
- Android SDK Build Tools
- Android Emulator or physical device

#### iOS (macOS only)

- Xcode 14+
- CocoaPods
- iOS Simulator or physical device

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode/formulus
```

### Step 2: Install Dependencies

```bash
cd ../packages/tokens && pnpm install && pnpm run build && cd ../formulus
pnpm install
```

### Step 3: Install iOS Dependencies

<Tabs>
  <TabItem value="mac" label="macOS">

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

  </TabItem>
  <TabItem value="linux-windows" label="Linux/Windows">

iOS development is only available on macOS. Skip this step if you're developing for Android only.

  </TabItem>
</Tabs>

### Step 4: Generate API Client

Generate the Synkronus API client from OpenAPI spec:

```bash
pnpm run generate:api
```

### Step 5: Generate WebView Injection Script

Generate the JavaScript injection script:

```bash
pnpm run generate
```

### Step 6: Start Metro Bundler

```bash
pnpm start
```

Keep this terminal open. Metro is the JavaScript bundler.

### Step 7: Run on Device/Emulator

<Tabs>
  <TabItem value="android" label="Android">

```bash
pnpm run android
```

This will:
1. Build the Android app
2. Install it on your connected device/emulator
3. Start the app
4. Connect to Metro bundler

  </TabItem>
  <TabItem value="ios" label="iOS (macOS only)">

```bash
pnpm run ios
```

This will:
1. Build the iOS app
2. Install it on your iOS Simulator or connected device
3. Start the app
4. Connect to Metro bundler

  </TabItem>
</Tabs>

## Development Workflow

### Hot Reload

Changes to JavaScript/TypeScript files automatically reload:

- **Fast Refresh**: React components update without losing state
- **Live Reload**: Full app reload on some changes
- **Error Overlay**: Errors displayed in app

### Debugging

#### React Native Debugger

1. Shake device or press `Ctrl+M` (Windows/Linux) or `Cmd+M` (macOS)
2. Select "Debug"
3. Chrome DevTools opens
4. Set breakpoints and inspect code

#### Logging

```typescript
import { console } from 'react-native'

console.log('Debug message')
console.warn('Warning message')
console.error('Error message')
```

View logs:

<Tabs>
  <TabItem value="android" label="Android">

```bash
adb logcat | grep -i formulus
```

  </TabItem>
  <TabItem value="ios" label="iOS">

View logs in Xcode console:
1. Open Xcode
2. Run the app
3. View logs in the bottom panel

Or use Console.app on macOS:
```bash
# Filter for your app
log stream --predicate 'processImagePath contains "Formulus"'
```

  </TabItem>
  <TabItem value="windows" label="Windows">

For Android development on Windows:

```powershell
adb logcat | Select-String formulus
```

Or using Git Bash/WSL:

```bash
adb logcat | grep -i formulus
```

For iOS development, Windows is not supported. Use macOS with Xcode.

  </TabItem>
</Tabs>

### Testing

```bash
# Run tests (do not use `pnpm test -- --watch`; use pnpm run test)
pnpm run test

# CI-style run
pnpm run test --ci --coverage --watchAll=false
```

## Building for Production

### Android Production Build

#### Step 1: Generate Signing Key

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore formulus-release.keystore -alias formulus -keyalg RSA -keysize 2048 -validity 10000
```

#### Step 2: Configure Signing

Edit `android/gradle.properties`:

```properties
FORMULUS_RELEASE_STORE_FILE=formulus-release.keystore
FORMULUS_RELEASE_KEY_ALIAS=formulus
FORMULUS_RELEASE_STORE_PASSWORD=your-store-password
FORMULUS_RELEASE_KEY_PASSWORD=your-key-password
```

#### Step 3: Build APK

```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

#### Step 4: Build AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

AAB location: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS Production Build (macOS only)

#### Step 1: Configure Signing

1. Open `ios/Formulus.xcworkspace` in Xcode
2. Select project in navigator
3. Go to "Signing & Capabilities"
4. Select team and provisioning profile

#### Step 2: Build Archive

1. In Xcode: Product → Archive
2. Wait for build to complete
3. Distribute App in Organizer

#### Step 3: Export IPA

1. Select archive in Organizer
2. Click "Distribute App"
3. Choose distribution method (App Store, Ad Hoc, Enterprise)
4. Follow export wizard

## Project Structure

### Key Directories

- `src/`: TypeScript source code
- `android/`: Android native code
- `ios/`: iOS native code
- `assets/`: Static assets (images, fonts, etc.)

### Important Files

- `App.tsx`: Main application component
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript configuration
- `metro.config.js`: Metro bundler configuration
- `babel.config.js`: Babel configuration

## Common Tasks

### Adding Dependencies

```bash
pnpm add package-name
```

For native dependencies, may need to:

```bash
# Android
cd android && ./gradlew clean && cd ..

# iOS
cd ios && pod install && cd ..
```

### Updating API Client

When Synkronus API changes:

```bash
pnpm run generate:api
```

### Updating WebView Interface

When Formulus interface changes:

```bash
pnpm run generate
```

### Cleaning Build

```bash
# Android
cd android && ./gradlew clean && cd ..

# iOS
cd ios && xcodebuild clean && cd ..

# Remove node_modules
rm -rf node_modules
pnpm install
```

## Troubleshooting

### Common Issues

**Metro Bundler Won't Start:**
- Clear Metro cache: `pnpm start -- --reset-cache`
- Android: if Gradle reports missing `:notifee_core`, run `pnpm run vendor:notifee` (or use `pnpm run android`, which runs it via `preandroid`)
- Delete `node_modules` and reinstall

**Build Fails:**
- Clean build: `cd android && ./gradlew clean`
- Check Java version: `java -version` (should be 11+)
- Verify Android SDK is installed

**iOS Build Fails:**
- Run `pod install` in `ios/` directory
- Clean build folder in Xcode
- Check signing configuration

**App Crashes on Launch:**
- Check logs: `adb logcat` or Xcode console
- Verify API client is generated
- Check WebView injection script is generated

## Related Documentation

- [Installing Formulus for Development](/docs/development/installing-formulus-dev) - ADB/emulator setup
- [Formulus Reference](/reference/formulus) - Component reference
- [Building and Testing](/development/building-testing) - Build procedures

