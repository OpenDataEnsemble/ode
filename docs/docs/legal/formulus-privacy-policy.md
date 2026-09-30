---
sidebar_position: 2
title: Formulus privacy policy
---

# Privacy Policy for Formulus

**Effective date:** 12 September 2025  
**Last updated:** 4 June 2026

## Overview

**Formulus** is a data collection application published by **Open Data Ensemble (ODE)**. It prioritizes user privacy and data ownership. This policy explains how the app handles information.

The canonical source for this policy is also maintained in the [ode repository](https://github.com/OpenDataEnsemble/ode/blob/main/formulus/PRIVACY_POLICY.md).

## Our privacy commitment

**Open Data Ensemble does not collect, store, or have access to your personal data or field observations.** Data you create in Formulus remains under your control. It is stored on your device and, when you choose to sync, on the **Synkronus server you configure**.

## Data collection and storage

### What we do not collect

- Personal information about you as an end user
- Your observation data or form responses
- Usage analytics or behavioral data for advertising
- Device identifiers for cross-app tracking
- Location data (except what you explicitly capture in forms on your device)

### What stays on your device

The following may be stored locally on your device:

- App settings and configuration
- Authentication credentials for your sync server (stored using platform secure storage)
- Cached form specifications
- Observation data and attachments you create
- Sync status and version information

### Your data, your server

- Observation data and attachments sync only with endpoints **you** provide
- You configure the sync server URL in the app
- ODE has no access to or control over your sync server
- Your data does not pass through ODE-operated collection servers

## Third-party services

### Google Play Store

If you install Formulus from Google Play, Google may collect information according to [Google’s privacy policy](https://policies.google.com/privacy). That is outside ODE’s control.

You may also obtain Formulus from [F-Droid](https://f-droid.org/) or build from [source](https://github.com/OpenDataEnsemble/ode) if you prefer distribution outside Google Play.

### Your sync server

When you configure a sync endpoint, synchronization occurs directly between the app and that server. The **server operator** (your organization or hosting provider) is responsible for how data is stored and processed on the server.

## Permissions

The Android app may request:

- **Internet** — sync with your configured server
- **Storage / media** — save observations and attachments locally
- **Camera** — capture photos when you use photo fields (only when you initiate)
- **Location** — when forms or features you use request location (only when you initiate)
- **Notifications** — sync progress and completion status

## Data security

- Local data uses standard Android storage practices
- Connections to your sync server should use **HTTPS** (recommended and defaulted when entering server URLs)
- Authentication tokens are stored using secure storage (e.g. React Native Keychain)
- ODE does not operate a central cloud that receives your field data

## Your rights and control

- **Data ownership** — observation data belongs to you and your organization
- **Data portability** — data syncs to servers you control
- **Local deletion** — uninstalling the app or clearing app storage removes local data
- **Account and server data** — see [Account and data deletion](./formulus-account-deletion)

## Children’s privacy

Formulus is not directed at children. It does not knowingly collect personal information from children under 13 through ODE systems. Use by minors should be under appropriate supervision and according to your organization’s policies.

## Changes to this policy

We may update this policy occasionally. The “Last updated” date at the top will change when we do. Material changes may also be noted in release notes or project documentation.

## Data processing roles

- **ODE** provides the Formulus application software; it does not act as controller of your field data on your Synkronus server
- **Your sync server operator** is responsible for compliance for data stored on that server
- **You / your organization** are typically the controller for data you collect using Formulus

## Contact

Questions about this privacy policy:

- **Email:** [hello@opendataensemble.org](mailto:hello@opendataensemble.org)
- **Website:** [opendataensemble.org](https://opendataensemble.org)

## Technical summary

- Local storage (e.g. AsyncStorage, device file system)
- Direct HTTPS connections to user-configured Synkronus endpoints
- No background transmission of field data to ODE-operated servers
- Open source: [github.com/OpenDataEnsemble/ode](https://github.com/OpenDataEnsemble/ode)
