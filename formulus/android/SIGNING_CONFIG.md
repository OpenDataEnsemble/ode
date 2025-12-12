# Android Signing Configuration

## Overview

This document explains how the Android app signing is configured for the Formulus app.

## Application ID

The app uses the application ID: `org.opendataensemble.formulus`

This is consistently set in:

- `android/app/build.gradle` - `applicationId` and `namespace`
- All Kotlin source files in `android/app/src/main/java/org/opendataensemble/formulus/`

## Keystore Configuration

### Debug Builds

Debug builds use the default Android debug keystore located at:

- `android/app/debug.keystore`
- Alias: `androiddebugkey`
- Password: `android`

### Release Builds

Release builds use a production keystore configured via `android/local.properties`.

**Required properties in `local.properties`:**

```properties
FORMULUS_RELEASE_STORE_FILE=keystores/formulus-signing.jks
FORMULUS_RELEASE_STORE_PASSWORD=your_keystore_password
FORMULUS_RELEASE_KEY_ALIAS=your_key_alias
FORMULUS_RELEASE_KEY_PASSWORD=your_key_password
```

**Important Notes:**

- The `local.properties` file is gitignored and should never be committed
- The `FORMULUS_RELEASE_STORE_FILE` path is relative to the `android/` directory (project root)
- Recommended location: `android/keystores/formulus-signing.jks`
- If `local.properties` doesn't exist or is missing signing properties, release builds will fall back to the debug keystore

## Build Configuration

The signing configuration is loaded in `android/app/build.gradle`:

```gradle
// Load keystore properties from local.properties
def keystorePropertiesFile = rootProject.file("local.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        debug {
            storeFile = file('debug.keystore')
            storePassword = 'android'
            keyAlias = 'androiddebugkey'
            keyPassword = 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile = file(keystoreProperties['FORMULUS_RELEASE_STORE_FILE'])
                storePassword = keystoreProperties['FORMULUS_RELEASE_STORE_PASSWORD']
                keyAlias = keystoreProperties['FORMULUS_RELEASE_KEY_ALIAS']
                keyPassword = keystoreProperties['FORMULUS_RELEASE_KEY_PASSWORD']
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.debug
        }
        release {
            signingConfig = keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
            minifyEnabled = enableProguardInReleaseBuilds
            proguardFiles = [getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"]
        }
    }
}
```

## Building Release APK/AAB

To build a release version:

```powershell
# Build release APK
cd android
.\gradlew assembleRelease

# Build release AAB (for Play Store)
.\gradlew bundleRelease
```

The signed outputs will be located at:

- APK: `android/app/build/outputs/apk/release/formulus-v{version}-{versionCode}-release-{date}.apk`
  - Example: `formulus-v1.0-1-release-20251006.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

The APK filename includes:

- App name: `formulus`
- Version name: from `versionName` in build.gradle (e.g., `v1.0`)
- Version code: from `versionCode` in build.gradle (e.g., `1`)
- Build type: `debug` or `release`
- Build date: in `yyyyMMdd` format

## Security Best Practices

1. **Never commit `local.properties`** - It's already in `.gitignore`
2. **Never commit the keystore file** - Keep it in a secure location
3. **Use strong passwords** for both keystore and key alias
4. **Backup your keystore** - If you lose it, you cannot update your app on Play Store
5. **Consider using environment variables** for CI/CD pipelines instead of local.properties

## Verifying the Configuration

To verify your signing configuration is working:

```powershell
# Clean build
cd android
.\gradlew clean

# Build release
.\gradlew assembleRelease

# Verify the APK signature
# Using keytool (comes with JDK)
# Replace the filename with your actual build output
keytool -printcert -jarfile app\build\outputs\apk\release\formulus-v1.0-1-release-20251006.apk
```

You should see your certificate details (not the debug certificate).
