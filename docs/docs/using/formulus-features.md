---
sidebar_position: 5
---

# Formulus Features

Complete user guide for the Formulus mobile application features and capabilities.

## Overview

Formulus is an offline-first mobile data collection application that enables field workers to collect structured data in environments with limited or no connectivity. The app works seamlessly with custom applications and provides comprehensive data collection capabilities.

## Core Features

### Offline-First Architecture

Formulus is designed to work completely offline:

- **Local Storage**: All data is stored locally on your device using WatermelonDB
- **Offline Forms**: Fill out forms without internet connection
- **Automatic Sync**: Data syncs automatically when connectivity is restored
- **No Data Loss**: Observations are saved locally even if sync fails

### Custom Application Support

Formulus can host custom web applications:

- **Custom Interfaces**: Run specialized workflows and user interfaces
- **Branded Experience**: Display your organization's branding and styling
- **Flexible Navigation**: Custom menus and navigation structures
- **Integrated Forms**: Seamless integration with the form system

### Rich Data Collection

Support for various data types:

- **Text Input**: Single and multi-line text fields
- **Numbers**: Integer and decimal numeric values
- **Dates and Times**: Date pickers, time selectors, and datetime fields
- **Selections**: Single choice dropdowns and multi-select checkboxes
- **Media Capture**: Photos, audio recordings, and video
- **Location**: GPS coordinates with accuracy information
- **Signatures**: Digital signature capture
- **Files**: File attachments and document uploads
- **Barcodes**: QR code and barcode scanning

### Synchronization

Bidirectional data synchronization:

- **Automatic Sync**: Syncs when network becomes available
- **Manual Sync**: Trigger sync on demand
- **Incremental Updates**: Only syncs changed data
- **Conflict Resolution**: Automatically handles sync conflicts
- **Attachment Handling**: Separate sync for binary files

## App Navigation

### Main Screens

| Screen | Description | Access |
|--------|-------------|--------|
| **Home/Dashboard** | Overview and quick actions | Default screen after login |
| **Forms** | List of available forms | Bottom tab or menu |
| **Observations** | Saved data records | Bottom tab or menu |
| **Sync** | Sync status and actions | Bottom tab or menu |
| **Settings** | App configuration | Menu or gear icon |

### Navigation Elements

- **Bottom Tabs**: Quick access to main sections
- **Menu Drawer**: Swipe from left or tap hamburger icon (☰)
- **Back Button**: Return to previous screen
- **Floating Action Button**: Quick actions (+ button)

## Working with Forms

### Viewing Available Forms

1. Navigate to the **Forms** screen
2. View the list of available forms from the current app bundle
3. Each form displays:
   - Form name/title
   - Description (if available)
   - Icon (if configured)

### Starting a New Form

1. Tap on a form from the list
2. Form opens in the form player
3. Fill in fields as required
4. Navigate through form sections using Next/Previous buttons or swiping

### Form Field Types

| Field Type | Description | Input Method |
|------------|-------------|--------------|
| **Text** | Single/multi-line text | Keyboard input |
| **Number** | Numeric values | Number keyboard |
| **Date** | Date selection | Date picker |
| **Time** | Time selection | Time picker |
| **Select** | Single choice | Dropdown/radio buttons |
| **Multi-select** | Multiple choices | Checkboxes |
| **Photo** | Camera capture | Camera interface |
| **GPS** | Location capture | GPS sensor |
| **Signature** | Digital signature | Touch drawing |
| **Audio** | Voice recording | Microphone |
| **Video** | Video recording | Camera |
| **File** | File attachment | File picker |
| **QR Code** | Scan QR/barcode | Camera scanner |

### Form Navigation

- **Swipe Left/Right**: Navigate between form sections
- **Next/Previous Buttons**: Move through form step by step
- **Progress Bar**: Shows completion status
- **Section Tabs**: Jump to specific sections (if enabled)

### Saving Forms

#### Save as Draft

1. Tap **"Save Draft"** at any time while filling the form
2. Form is saved locally with current data
3. Resume later from the Observations screen
4. Draft status is shown in the observation list

#### Submit/Finalize

1. Complete all required fields
2. Tap **"Submit"** or **"Finalize"**
3. Validation runs automatically - errors shown if any
4. Observation saved as pending upload
5. Will sync when connection is available

### Form Validation

Forms may include validation rules:

- **Required Fields**: Must be filled before submission
- **Format Validation**: Email, phone number, and other format checks
- **Range Validation**: Minimum and maximum values
- **Conditional Logic**: Fields shown based on other answers

**Validation Errors:**
- Red highlight on invalid fields
- Error messages displayed below fields
- Cannot submit until all errors are resolved

## Managing Observations

### Viewing Observations

1. Navigate to the **Observations** screen
2. View list of all saved observations
3. Each entry shows:
   - Form name
   - Date/time created
   - Status (draft, pending, synced)
   - Key data fields

### Observation Status

| Status | Description |
|--------|-------------|
| **Draft** | Incomplete, can be edited |
| **Pending** | Complete, awaiting sync |
| **Syncing** | Currently uploading to server |
| **Synced** | Successfully uploaded to server |
| **Error** | Sync failed, retry needed |

### Editing Observations

#### Edit Draft

1. Tap on a draft observation
2. Form opens with saved data
3. Make changes as needed
4. Save or Submit

#### Edit Pending (if allowed)

1. Tap on a pending observation
2. May need to "Unlock" for editing
3. Make changes
4. Re-submit

### Deleting Observations

1. Long-press on observation or tap menu (⋮)
2. Select **"Delete"**
3. Confirm deletion

**Note**: Synced observations may not be deletable locally depending on configuration.

## Synchronization

### Automatic Sync

The app automatically syncs when:

- Network connection becomes available
- App is opened (background sync)
- Periodically (if configured in settings)

### Manual Sync

1. Navigate to **Sync** screen
2. Tap **"Sync Now"**
3. Watch progress - upload count and status
4. Check results - success/failure messages

### Sync Process

1. **Pull**: Download new forms and server data (starts at 32 observations per page)
2. **Push**: Upload pending observations (starts at 4 per batch)
3. **Attachments**: Upload photos, audio, and other files (one at a time)
4. **Confirmation**: Server acknowledges receipt

Observation records can finish syncing while photos are still transferring. Page sizes grow on a good link and shrink on a slow one; there is no Settings control for this.

### Sync Indicators

- **Sync Icon**: Appears in status bar when syncing
- **Badge on Sync Tab**: Shows pending upload count
- **Last Sync Time**: Displayed on sync screen
- **Individual Status**: Each observation shows its sync status

### Offline Mode

When offline, you can:

- ✅ Fill out forms
- ✅ Save observations locally
- ✅ View previously synced data
- ❌ Cannot upload new data
- ❌ Cannot download new forms

Data syncs automatically when connection returns.

## Attachments

### Capturing Photos

1. Tap photo field in form
2. Camera opens automatically
3. Take photo or select from gallery
4. Review and confirm
5. Photo is attached to observation

### Capturing GPS Location

1. Tap GPS field in form
2. Location permission requested (first time only)
3. Wait for GPS fix
4. Coordinates captured (latitude, longitude, accuracy)
5. May show map preview

### Recording Audio

1. Tap audio field in form
2. Microphone permission requested (first time only)
3. Tap record to start
4. Speak clearly
5. Tap stop when done
6. Review and confirm

### Capturing Signatures

1. Tap signature field in form
2. Signature pad opens
3. Sign with finger on screen
4. Tap "Done" to save
5. Tap "Clear" to retry

### Recording Video

1. Tap video field in form
2. Camera opens in video mode
3. Tap record to start
4. Tap stop when done
5. Review and confirm

### Scanning QR Codes

1. Tap QR code field in form
2. Camera opens in scanner mode
3. Point camera at QR code
4. Code is automatically scanned
5. Data is populated in the field

## Settings

### Server Settings

- **Server URL**: Synkronus server address
- **Test Connection**: Verify connectivity to server
- **Auto-login**: Automatically log in on app start

### User Settings

- **Username**: Current logged-in user
- **Change Password**: Update account password
- **Logout**: Clear session and return to login

### Sync Settings

- **Auto-sync**: Enable/disable automatic synchronization
- **Sync on WiFi Only**: Save mobile data by syncing only on WiFi
- **Sync Interval**: How often to check for sync (if auto-sync enabled)

### App Settings

- **Notifications**: Enable/disable push notifications
- **Theme**: Light or dark mode
- **Language**: App language selection
- **Clear Cache**: Free up storage space
- **Storage Info**: View storage usage

## Best Practices

### Data Collection

1. **Sync Before Fieldwork**: Get latest forms and updates
2. **Check Battery**: Ensure sufficient charge for field work
3. **Test GPS Outdoors**: Better accuracy in open areas
4. **Save Frequently**: Avoid data loss from app crashes
5. **Sync When Possible**: Don't wait too long between syncs

### Offline Work

1. **Sync Before Going Offline**: Download latest forms and data
2. **Save Observations as You Go**: Don't wait until the end
3. **Check Pending Count**: Verify all data before leaving field
4. **Sync Immediately**: When back online, sync right away

### Data Quality

1. **Fill All Required Fields**: Complete forms fully
2. **Double-Check Entries**: Verify accuracy before submitting
3. **Take Clear Photos**: Ensure photos are in focus and well-lit
4. **Verify GPS Accuracy**: Check location accuracy before submitting
5. **Review Before Submitting**: Review all data before final submission

## Troubleshooting

### Forms Not Loading

- Check internet connection
- Verify server is accessible
- Try manual sync: Settings → Sync → Sync Now
- Clear app cache: Settings → Storage → Clear Cache

### Sync Failures

- Check internet connection
- Verify server URL is correct
- Check server status
- Try manual sync
- Review error messages in Sync screen

### App Crashes

- Restart the app
- Clear app cache
- Update to latest version
- Reinstall if issues persist

## Related Documentation

- [Installing Formulus](/docs/getting-started/installation/installing-formulus) - Installation guide
- [Your First Form](/using/your-first-form) - Getting started with forms
- [Synchronization](/using/synchronization) - Detailed sync information
- [Working Offline](/using/working-offline) - Offline capabilities
- [App Bundles](/using/app-bundles) - Understanding app bundles

