import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import RNFS from 'react-native-fs';
import { RootStackParamList } from '../types/NavigationTypes';
import { synkronusApi } from '../api/synkronus';

const SyncScreen = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Ready');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Sync'>>();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setStatus('Starting sync...');
      
      // Get the manifest
      setStatus('Fetching manifest...');
      const manifest = await synkronusApi.getManifest();
      console.log('Manifest:', manifest);

      // Download form specs
      setStatus('Downloading form specs...');
      await synkronusApi.downloadFormSpecs(
        manifest, 
        RNFS.DocumentDirectoryPath, 
        (progress) => {
          setStatus(`Downloading form specs... ${progress}%`);
        }
      );
      
      // Download app files
      setStatus('Downloading app files...');
      const results = await synkronusApi.downloadAppFiles(
        manifest, 
        RNFS.DocumentDirectoryPath, 
        (progress) => {
          setStatus(`Downloading app files... ${progress}%`);
        }
      );
      console.log('Download results:', results);
      // Update UI
      const syncTime = new Date().toLocaleTimeString();
      setLastSync(syncTime);
      setStatus('Sync completed');
      if (results.some(r => !r.success)) {
        Alert.alert('Error', 'Failed to sync!\n' + results.filter(r => !r.success).map(r => r.message).join('\n'));
      } else {
        Alert.alert('Success', 'Data synchronized successfully');
      }
    } catch (error) {
      console.error('Sync failed', error);
      setStatus('Sync failed');
      Alert.alert('Error', 'Failed to sync!\n' + error);
    } finally {
      setIsSyncing(false);
    }
  };

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
            {lastSync || 'Never'}
          </Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, isSyncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <Text style={styles.buttonText}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
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
