# Privacy Policy for Formulus

**Effective Date:** 2025-09-12  
**Last Updated:** 2025-09-12

## Overview

Formulus is a data collection application that prioritizes user privacy and data ownership. This privacy policy explains how the app handles your information.

## Our Privacy Commitment

**We do not collect, store, or have access to your personal data.** All data you create in Formulus remains under your complete control.

## Data Collection and Storage

### What We DON'T Collect

- Personal information about you
- Your observation data or form responses
- Usage analytics or behavioral data
- Device identifiers for tracking purposes
- Location data (beyond what you explicitly choose to include in forms)

### What Data Stays on Your Device

The following information is stored locally on your device only:

- App settings and configuration
- Authentication credentials for your sync server
- Cached form specifications
- Observation data and attachments you create
- Sync status and version information

### Your Data, Your Server

- All observation data and attachments are synchronized exclusively with endpoints YOU provide
- You configure the sync server URL in the app settings
- We have no access to or control over your sync server
- Your data never passes through our servers

## Third-Party Services

### Google Play Store

When you download Formulus from Google Play Store, Google may collect information according to their privacy policy. This is outside our control and governed by Google's terms.

**Alternative Distribution**: If you prefer to avoid Google's data collection entirely, you can compile the APK directly from the source code and distribute it yourself, bypassing the Google Play Store completely.

### Your Sync Server

When you configure a sync endpoint, all data synchronization occurs directly between the app and your chosen server. We are not involved in this data transfer.

## Permissions

The app requests the following permissions:

- **Internet Access**: To sync with your configured server endpoint
- **Storage Access**: To save observation data and attachments locally
- **Camera Access**: To capture photos when using photo fields (only when you initiate)
- **Notifications**: To show sync progress and completion status

## Data Security

- All data is stored locally on your device using standard Android security practices
- Network communications with your sync server use HTTPS encryption
- Authentication tokens are stored securely using React Native Keychain
- No data is transmitted to third parties without your explicit configuration

## Your Rights and Control

You have complete control over your data:

- **Data Ownership**: All observation data belongs to you
- **Data Portability**: Your data syncs to servers you control
- **Data Deletion**: Uninstalling the app removes all local data
- **Server Control**: You choose and control your sync endpoints

## Children's Privacy

Formulus does not knowingly collect personal information from children under 13. Since we don't collect personal data from any users, this app can be used by individuals of any age under appropriate supervision.

## Changes to This Policy

We may update this privacy policy occasionally. Any changes will be reflected in the app and on our website with an updated "Last Updated" date.

## Data Processing Legal Basis

Since we do not collect or process personal data:

- No legal basis for data processing is required from our side
- Your sync server operator is responsible for their own data processing compliance
- You are the data controller for any data you collect using Formulus

## Contact Information

If you have questions about this privacy policy, please contact us at:

- Email: hello@sapiens-solutions.com
- Website: https://opendataensemble.org

## Technical Details

For transparency, here's how the app works technically:

- Local data storage using AsyncStorage and React Native File System
- Direct HTTPS connections to user-configured sync endpoints
- No background data transmission to developer-controlled servers
- Open source architecture (if applicable - add GitHub link)

---

**Summary**: Formulus is designed with privacy by design. We don't collect your data because we don't need to. Your data stays with you, syncs to servers you control, and we never see it.
