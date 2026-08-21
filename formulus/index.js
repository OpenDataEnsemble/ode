/**
 * @format
 */

import { AppRegistry, Platform } from 'react-native';
import notifee from '@notifee/react-native';
// Initialize axios interceptors BEFORE any other imports that might make API calls
// This ensures version mismatch errors are handled from the very first request
import { setupSynkronusClientInterceptors } from './src/api/synkronus/client';
import { installErrorHandlers } from './src/diagnostics';
import App from './App';
import { name as appName } from './app.json';

// Set up interceptors immediately - before any React components or contexts load
setupSynkronusClientInterceptors();
installErrorHandlers();

if (Platform.OS === 'android') {
  notifee.registerForegroundService(() => {
    return new Promise(() => {});
  });
}

AppRegistry.registerComponent(appName, () => App);
