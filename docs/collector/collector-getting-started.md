---
sidebar_position: 1
title: Getting Started with Formulus
---

# Getting Started: Data Collection with Formulus

This guide walks you through installing Formulus and submitting your first form. It should take about **10-15 minutes**.

## What You'll Need

Before starting, make sure you have:

- ✅ A smartphone (Android 8.0+ or iOS 13.0+)
- ✅ Internet access (for downloading and initial setup)
- ✅ Instructions from your project manager (server URL, project code, or app link)

## Step 1: Install Formulus

### Option A: F-Droid (Android)

1. Open the [Formulus page on F-Droid](https://f-droid.org/en/packages/org.opendataensemble.formulus/)
2. Install the F-Droid client if prompted
3. Tap **Install** and wait for the download to complete

### Option B: App Store (iPhone and iPad)

1. Open the [Formulus App Store page](https://apps.apple.com/dk/app/formulus/id6798318215)
2. Tap **Get**
3. Authenticate with Face ID, Touch ID, or Apple ID
4. Wait for installation to complete

### Option C: Obtainium or direct APK (Android)

Use [Obtainium](https://github.com/ImranR98/Obtainium) with `https://github.com/OpenDataEnsemble/ode` for updates from GitHub Releases, or download the APK directly from [Downloads](/downloads).

:::note
The [Downloads](/downloads) page has the current Android APK and all desktop/CLI downloads.
:::

## Step 2: Open Formulus & Connect to Your Project

1. **Open Formulus** - Tap the app icon on your home screen
2. **See the welcome screen** - You'll see the Formulus logo and connection options
3. **Enter Server Details** - Ask your project manager for:
   - Server URL (e.g., `https://forms.myorganization.org`)
   - Project Code or QR code
4. **Authenticate** - Enter credentials provided by your project manager
5. **Download Forms** - Formulus will download available forms for your project

:::tip Getting Your Server Details
Your project manager should provide you with:
- The server web address
- Your username and password (or a QR code)
- The project or team you're assigned to

If you don't have these, contact your project manager.
:::

## Step 3: Submit Your First Form

### Opening a Form

1. **Tap the "+" button** or **"New Submission"** in the app
2. **Select a form** from the list
3. **Read the form title** - This tells you what you're collecting

### Filling Out the Form

Forms contain different types of fields:

| Type | How to Fill | Example |
|------|-----------|---------|
| **Text** | Type your answer | Name, comments |
| **Number** | Enter digits | Age, count |
| **Date** | Tap to pick a date | Birthday, visit date |
| **Multiple Choice** | Select one option | Gender, yes/no |
| **Photo** | Tap camera icon | Pictures of situation |
| **GPS** | Tap location button | Geographic coordinates |

:::info Required Fields
Fields marked with a **red asterisk (*)** must be filled out before submitting.
:::

### Example: Simple Survey

Let's say you're filling out a health survey:

```
Question: What is your name?
↓ Type: "John Smith"

Question: What is your age?
↓ Tap number field and type: "32"

Question: Are you feeling healthy today?
↓ Select: "Yes" or "No"

Question: Date of visit
↓ Tap calendar icon and select today's date
```

### Validating Your Answers

**As you type**, Formulus checks if your answers are valid:

- ✅ **Green checkmark** = Answer is correct
- ❌ **Red error** = Something is wrong (e.g., age over 150)
- ⚠️ **Yellow warning** = Be careful with this answer

Fix any errors before submitting.

## Step 4: Submit the Form

### When You're Done

1. **Review your answers** - Scroll up to check everything
2. **Look for the Submit button** - Usually at the bottom
3. **Tap Submit** - Formulus will validate your form
4. **Confirm** - You'll see a message saying the form was submitted

### What Happens After Submit?

```
Submitted Locally
    ↓
Form saved on your phone
    ↓
Waiting to sync with server
    ↓
[When you connect to internet]
    ↓
Synced to Server ✅
```

You'll see a **"Submitted"** section in the app showing all your completed forms.

## Step 5: Sync Your Data

Syncing sends your completed forms from your phone to the server.

### Automatic Sync

When your phone has internet:
- Formulus automatically syncs in the background
- You'll see a sync icon (🔄) at the top of the app
- Submissions appear as "Synced"

### Manual Sync

To sync manually:

1. **Tap the sync icon** (usually at top-right of app)
2. **Wait for the sync to complete**
3. **Check the status** - Green checkmark means success

:::tip Sync Status
- 🟢 **Synced** - Successfully sent to server
- 🟡 **Pending** - Waiting to sync
- 🔄 **Syncing** - Currently sending
- ❌ **Error** - Check your connection

If sync fails, check:
1. Do you have internet?
2. Is the server accessible?
3. Are you still logged in?

Contact your project manager if problems persist.
:::

## Working Offline

One of ODE's superpowers is **offline capability**.

### Can I Work Without Internet?

**Yes!** You can:
- ✅ Create new submissions
- ✅ Fill out forms completely
- ✅ Take photos and record audio
- ✅ Save your work

### How Offline Works

```
No Internet Available
    ↓
Forms stored on phone
    ↓
You create & save submissions
    ↓
Data saved locally (not on server yet)
    ↓
When you connect to internet
    ↓
Formulus syncs automatically
    ↓
Data is now on server
```

### Tips for Offline Work

1. **Download forms before going offline** - Do this at the office
2. **Check you have battery** - Offline sync uses battery
3. **Keep phone storage available** - Each form needs storage space
4. **Sync when you can** - Try syncing at least daily

:::warning Data Safety
Your data is safe on your phone until synced. To prevent data loss:
- Don't delete the Formulus app
- Don't clear app data
- Back up your phone regularly
- Sync at least once per day
:::

## Common Tasks

### Viewing Submitted Forms

1. **Tap the "Submitted" tab** (or similar view in your app)
2. **See all your submissions** - Shows dates and status
3. **Tap a submission to view details** if needed

### Editing a Draft

If you saved a form but didn't submit:

1. **Tap the "Draft" or "Saved" section**
2. **Tap the form to edit it**
3. **Make changes**
4. **Submit when ready**

### Logging Out

1. **Tap Settings** (gear icon)
2. **Tap Logout**
3. **Confirm** - You'll return to login screen

:::note After Logging Out
You won't be able to see forms until you log back in.
:::

### Updating Forms

Your project manager may release new forms:

1. **Open Formulus**
2. **Tap the refresh/sync icon**
3. **New forms will appear** - They'll be available to use

## Troubleshooting Common Issues

### "I can't connect to the server"

**Causes:**
- No internet connection
- Wrong server URL
- Server is down

**Fix:**
1. Check you have WiFi or mobile data
2. Ask your project manager for correct server URL
3. Try again in 5 minutes
4. Contact your project manager if still failing

### "The app says my answer is invalid"

**Causes:**
- Value is outside expected range (e.g., age > 150)
- Wrong format (e.g., text when number expected)
- Required field is empty

**Fix:**
1. Check the error message
2. Review the field requirements
3. Enter the correct format
4. Try again

### "I lost my saved form"

**Causes:**
- App was force-closed
- Phone ran out of battery
- Storage space ran out

**Prevent:**
1. Submit forms as soon as complete
2. Keep phone battery charged (> 50%)
3. Delete old submissions to free space
4. Sync regularly

:::warning Data Recovery
Once submitted and synced, your data is safe on the server. Contact your project manager if data was lost before syncing.
:::

### "Sync keeps failing"

**Causes:**
- Poor internet connection
- Server temporarily unavailable
- Authentication expired

**Fix:**
1. Check internet connection (try browsing web)
2. Wait a few minutes
3. Log out and log back in
4. Restart the app
5. Contact your project manager if still failing

## Tips for Success

### Before You Start
- 📋 **Read form instructions** - Each form may have specific guidance
- 📱 **Make sure you're online** - Download forms while connected
- 🔋 **Charge your phone** - Ensure good battery level

### While Collecting
- ✏️ **Complete forms immediately** - Don't wait to fill them later
- 📸 **Use good lighting** - For photos (if required)
- 🔊 **Find quiet places** - If recording audio
- 🗺️ **Enable location** - If the form requests GPS data

### Before Submitting
- ✅ **Review your answers** - Make sure everything is correct
- 🔴 **Check for required fields** - Fields with * must be filled
- 📍 **Verify dates are correct** - Easy to enter wrong date by mistake

### After Submitting
- 🔄 **Sync as soon as possible** - When you have internet
- 📊 **Check if your data appears** - Ask your project manager to confirm
- 💾 **Keep backups** - Periodically back up your phone

## Next Steps

Congratulations! You've successfully submitted your first form. Now:

1. **[Learn about the app features](/docs/using/formulus-features)** - Explore what Formulus can do
2. **[Understand working offline](/docs/using/working-offline)** - Maximize battery and storage
3. **[Get help with issues](/docs/using/troubleshooting)** - Find solutions to common problems
4. **[Check the FAQ](/docs/getting-started/faq)** - Common questions answered

## Need Help?

- **App issue?** → [Troubleshooting Guide](/docs/using/troubleshooting)
- **Question about syncing?** → [Syncing Data](/docs/using/synchronization)
- **Need community help?** → [Get Help](/docs/community/getting-help)
- **Contact your project manager** → They know your specific project setup

---

:::tip Pro Tip
Most issues can be resolved by:
1. Checking your internet connection
2. Restarting the app
3. Syncing manually

If problems persist, contact your project manager.
:::

**Happy collecting!** 📱📊
