---
sidebar_position: 4
---

# Understanding App Bundles

Learn how app bundles work in ODE and how they enable custom applications and forms.

## What Are App Bundles?

App bundles are packaged collections of files that define custom applications for ODE. They contain everything needed to run a custom data collection application within the Formulus mobile app:

- **Custom web application** - HTML, CSS, and JavaScript files
- **Form specifications** - JSON schemas defining data collection forms
- **Configuration files** - Settings and metadata for the application
- **Assets** - Images, fonts, and other resources

When you open Formulus and connect to a Synkronus server, the app automatically downloads the current app bundle. This bundle determines what forms are available, how they look, and what workflows you can use.

## How App Bundles Work

### Download Process

1. **Initial Sync**: When you first log in to Formulus, the app checks the server for the current app bundle version
2. **Version Check**: The app compares the server's version with the version stored locally
3. **Download**: If a new version is available, the app downloads the bundle files
4. **Extraction**: The bundle is extracted and stored locally on your device
5. **Activation**: The new bundle becomes active, and you can use the updated forms and features

### Automatic Updates

App bundles update automatically:

- **On Login**: When you log in, the app checks for updates
- **On Manual Sync**: When you tap "Sync Now" in the app
- **Periodically**: The app may check for updates in the background (if configured)

### Version Management

Each app bundle has a version identifier (typically a timestamp). This ensures:

- **Consistency**: All devices use the same version of forms and workflows
- **Rollback**: Administrators can switch back to previous versions if needed
- **Tracking**: You can see which version of the app bundle you're using

## What's Inside an App Bundle

### Custom Application

The main component is a custom web application that runs inside Formulus. This application:

- **Provides Navigation**: Custom menus and screens for your workflow
- **Displays Forms**: Shows available forms and allows you to start data collection
- **Manages Data**: Lets you view, edit, and manage your observations
- **Custom Branding**: Can include your organization's logo and styling

### Form Specifications

App bundles include form definitions that specify:

- **Data Fields**: What information to collect (name, age, location, etc.)
- **Field Types**: How to input data (text, number, date, photo, GPS, etc.)
- **Validation Rules**: Requirements for data entry (required fields, value ranges, etc.)
- **Layout**: How the form is organized and presented

### Configuration

Bundles may include configuration files that:

- **Define Settings**: Application-specific settings and preferences
- **Specify Behavior**: How the application should behave in different scenarios
- **Set Permissions**: What features and data access the application needs

## Using App Bundles

### Accessing Your Application

1. **Open Formulus** on your device
2. **Log in** to your account
3. **Wait for sync** to complete (if first time or after update)
4. **Your custom application** loads automatically as the main interface

### Working with Forms

Once the app bundle is loaded:

1. **Navigate** through your custom application's interface
2. **Select a form** from the available forms list
3. **Fill out the form** with the required information
4. **Submit** the form to create an observation
5. **View observations** in your data management section

### Updating App Bundles

App bundles update automatically, but you can also manually trigger an update:

1. **Open Formulus** → **Settings** → **Sync**
2. **Tap "Sync Now"** or **"Force Download"**
3. **Wait for download** to complete
4. **App restarts** or refreshes with the new bundle

## Troubleshooting App Bundles

### Bundle Not Downloading

**Problem**: App bundle fails to download or sync.

**Solutions**:
- Check internet connection
- Verify server is accessible
- Try manual sync: Settings → Sync → Sync Now
- Clear app cache: Settings → Storage → Clear Cache
- Restart the app

### Forms Not Appearing

**Problem**: After sync, forms don't appear in the app.

**Solutions**:
- Verify bundle downloaded successfully (check Sync screen)
- Check bundle version matches server version
- Try force refresh: Settings → Sync → Force Download
- Clear app data and re-login (warning: deletes local data)

### Outdated Forms

**Problem**: Forms show old fields or structure.

**Solutions**:
- Check if bundle update is available: Settings → Sync
- Force download latest bundle: Settings → Sync → Force Download
- Verify server has the latest bundle version
- Contact administrator if issue persists

### Bundle Version Mismatch

**Problem**: App shows different version than expected.

**Solutions**:
- Force sync to get latest version
- Check server is serving the correct active version
- Verify you're connected to the correct server
- Contact administrator to verify bundle version

## App Bundle Best Practices

### For Users

1. **Sync Regularly**: Keep your app bundle up to date by syncing regularly
2. **Check Version**: Verify you're using the latest bundle version
3. **Report Issues**: If forms or features don't work, report to your administrator
4. **Backup Data**: Ensure observations are synced before major updates

### For Administrators

1. **Test Before Deploy**: Test new bundles thoroughly before activating
2. **Version Control**: Use clear version identifiers (timestamps recommended)
3. **Rollback Plan**: Keep previous versions available for quick rollback
4. **Notify Users**: Inform users when major updates are deployed
5. **Monitor Usage**: Track which versions are in use across devices

## Technical Details

For technical information about app bundle structure, format, and development, see:

- [App Bundle Format Reference](/reference/app-bundle-format) - Technical specification
- [Custom Applications Guide](/guides/custom-applications) - Building custom applications
- [Form Design Guide](/guides/form-design) - Creating form specifications

## ODE Desktop Workbench

On **ODE Desktop**, Synkronus bundles download into **`bundles/active/`** in the profile workspace. See [Bundles (Workbench)](/docs/using/ode-desktop/workbench-bundles) for download and version management.

To iterate on a **local** custom app build without replacing that download, use [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode) (mirror to `bundles/dev-local/`).

## Related Documentation

- [Your First Form](/using/your-first-form) - Get started with data collection
- [Synchronization](/using/synchronization) - Understand how data syncs
- [Formulus Features](/using/formulus-features) - Complete app feature guide
- [Working Offline](/using/working-offline) - Offline capabilities

