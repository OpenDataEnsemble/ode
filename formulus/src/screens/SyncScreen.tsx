import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncService } from '../services/SyncService';

const SyncScreen = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Loading...');
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Handle sync operations
  const handleSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      const version = await syncService.syncObservations(false);
      setDataVersion(version);
    } catch (error) {
      Alert.alert('Error', 'Failed to sync!\n' + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Handle app updates
  const handleCustomAppUpdate = useCallback(async () => {
    try {
      setIsSyncing(true);
      await syncService.updateAppBundle();
      setLastSync(new Date().toLocaleTimeString());
      setUpdateAvailable(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update app bundle!\n' + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async (force: boolean = false) => {
    try {
      const hasUpdate = await syncService.checkForUpdates(force);
      setUpdateAvailable(hasUpdate);
    } catch (error) {
      console.warn('Failed to check for updates', error);
    }
  }, []);

  // Initialize component
  useEffect(() => {
    // Set up status updates
    const unsubscribe = syncService.subscribeToStatusUpdates((newStatus) => {
      setStatus(newStatus);
    });

    // Initialize sync service
    const initialize = async () => {
      await syncService.initialize();
      await checkForUpdates(true); // Check for updates on initial load
      
      // Get last sync time
      const lastSyncTime = await AsyncStorage.getItem('@lastSync');
      if (lastSyncTime) {
        setLastSync(lastSyncTime);
      }
      
      // Get last seen version
      const lastSeenVersion = await AsyncStorage.getItem('@last_seen_version');
      if (lastSeenVersion) {
        setDataVersion(parseInt(lastSeenVersion, 10));
      }
    };

    initialize();

    // Clean up subscription
    return () => {
      unsubscribe();
    };
  }, [checkForUpdates]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Synchronization</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={styles.statusValue}>{status}</Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusValue}>
            {lastSync || 'Never'} @ version {dataVersion}
          </Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, isSyncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <Text style={styles.buttonText}>
              {isSyncing ? 'Syncing...' : 'Sync data + attachments'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, isSyncing  && styles.buttonDisabled]}
            onPress={handleCustomAppUpdate}
            disabled={isSyncing || !updateAvailable}
          >
            <Text style={styles.buttonText}>
              {isSyncing ? 'Syncing...' : 'Update forms and custom app'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Sync Details</Text>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Server:</Text>
            <Text style={styles.detailValue}>Synkronus</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>
              {new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  section: {
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#666',
    fontSize: 15,
  },
  detailValue: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default SyncScreen;
