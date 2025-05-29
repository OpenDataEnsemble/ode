import React, { useState } from 'react';
import {View,Text,StyleSheet,SafeAreaView,ScrollView,TouchableOpacity,ActivityIndicator,Alert} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/NavigationTypes';
import { getSynkronusApi } from '../api/synkronus';

const SyncScreen = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Sync'>>();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await doPull()
      console.log('Sync result:', res)
      setLastSync(new Date().toLocaleTimeString());
      Alert.alert('Success', 'Data synchronized successfully: ' + res);
    } catch (error) {
      console.error('Sync failed:', error);
      Alert.alert('Error', 'Failed to synchronize data: ' + error);
    } finally {
      setIsSyncing(false);
    }
  };

  const doPull = async () => {

    try {
      const api = await getSynkronusApi()
      const res = await api.appBundleVersionsGet()
      console.log('Pulled versions:', res)
      // const res = await api.syncPullPost({
      //   syncPullRequest: {
      //     client_id: 'my-device-id',
      //     after_change_id: 0,
      //     schema_types: ['survey'],
      //   },
      // })
      //console.log('Pulled records:', res.data.records)
      return JSON.stringify(res)
    } catch (err) {
      console.error('Pull failed', err)
      return JSON.stringify(err)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Synchronize Data</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusValue}>
            {lastSync || 'Never'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Available Actions</Text>
          
          <TouchableOpacity 
            style={[styles.button, isSyncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Sync Details</Text>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Server:</Text>
            <Text style={styles.detailValue}>Synkronus</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>
              {isSyncing ? 'Synchronizing...' : 'Ready to sync'}
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
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
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
