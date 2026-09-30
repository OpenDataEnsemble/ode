---
sidebar_position: 6
---

# Working Offline

ODE is designed to work seamlessly in offline conditions, allowing data collection to continue regardless of network connectivity.

## Offline Capabilities

When offline, you can:

- Create new observations
- Edit existing observations
- Delete observations
- View all locally stored observations
- Fill out forms completely

All changes are stored locally and synchronized when connectivity is restored.

## Local Storage

Observations are stored locally on the device using WatermelonDB, a reactive database optimized for React Native. This ensures:

- Fast access to data
- Reliable storage
- Efficient querying
- Automatic conflict resolution

## Synchronization When Online

When network connectivity is restored:

1. The app automatically detects connectivity
2. Synchronization begins automatically
3. Local changes are pushed to the server
4. New data is pulled from the server
5. Conflicts are resolved automatically

## Offline Indicators

The app provides visual indicators for offline status:

- Connection status in the app header
- Sync status for individual observations
- Notification when sync completes

## Best Practices

When working offline:

- Ensure sufficient device storage for observations
- Regularly sync when connectivity is available
- Monitor sync status to identify any issues
- Keep the app updated to ensure optimal offline performance

## Limitations

While offline, you cannot:

- Access server-side features
- Download new forms (unless previously cached)
- Access real-time collaboration features
- View server-side analytics

## Next Steps

- Learn about [synchronization](/using/synchronization) in detail
- Review [troubleshooting](/using/troubleshooting) for offline issues
- Explore [data management](/using/data-management) features

