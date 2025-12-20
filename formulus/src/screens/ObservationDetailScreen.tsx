import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Observation} from '../database/models/Observation';
import {FormService} from '../services/FormService';
import {openFormplayerFromNative} from '../webview/FormulusMessageHandlers';
import {useNavigation} from '@react-navigation/native';
import colors from '../theme/colors';

interface ObservationDetailScreenProps {
  route: {
    params: {
      observationId: string;
    };
  };
}

const ObservationDetailScreen: React.FC<ObservationDetailScreenProps> = ({
  route,
}) => {
  const {observationId} = route.params;
  const navigation = useNavigation();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadObservation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationId]);

  const loadObservation = async () => {
    try {
      setLoading(true);
      const formService = await FormService.getInstance();

      // Get all form types to find the observation
      const formSpecs = formService.getFormSpecs();
      let foundObservation: Observation | null = null;

      for (const formSpec of formSpecs) {
        const observations = await formService.getObservationsByFormType(
          formSpec.id,
        );
        const obs = observations.find(o => o.observationId === observationId);
        if (obs) {
          foundObservation = obs;
          setFormName(formSpec.name);
          break;
        }
      }

      if (!foundObservation) {
        Alert.alert('Error', 'Observation not found');
        navigation.goBack();
        return;
      }

      setObservation(foundObservation);
    } catch (error) {
      console.error('Error loading observation:', error);
      Alert.alert('Error', 'Failed to load observation');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!observation) return;

    try {
      const result = await openFormplayerFromNative(
        observation.formType,
        {},
        typeof observation.data === 'string'
          ? JSON.parse(observation.data)
          : observation.data,
        observation.observationId,
      );
      if (
        result.status === 'form_submitted' ||
        result.status === 'form_updated'
      ) {
        await loadObservation();
        Alert.alert('Success', 'Observation updated successfully');
      }
    } catch (error) {
      console.error('Error editing observation:', error);
      Alert.alert('Error', 'Failed to edit observation');
    }
  };

  const handleDelete = () => {
    if (!observation) return;

    Alert.alert(
      'Delete Observation',
      'Are you sure you want to delete this observation? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const formService = await FormService.getInstance();
              await formService.deleteObservation(observation.observationId);
              Alert.alert('Success', 'Observation deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting observation:', error);
              Alert.alert('Error', 'Failed to delete observation');
            }
          },
        },
      ],
    );
  };

  const renderDataField = (key: string, value: any, level: number = 0) => {
    if (value === null || value === undefined) {
      return (
        <View
          key={key}
          style={[styles.fieldContainer, {paddingLeft: level * 16}]}>
          <Text style={styles.fieldKey}>{key}:</Text>
          <Text style={styles.fieldValue}>null</Text>
        </View>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <View
          key={key}
          style={[styles.fieldContainer, {paddingLeft: level * 16}]}>
          <Text style={styles.fieldKey}>{key}:</Text>
          {Object.entries(value).map(([k, v]) =>
            renderDataField(k, v, level + 1),
          )}
        </View>
      );
    }

    if (Array.isArray(value)) {
      return (
        <View
          key={key}
          style={[styles.fieldContainer, {paddingLeft: level * 16}]}>
          <Text style={styles.fieldKey}>{key}:</Text>
          {value.map((item, index) => (
            <View key={index} style={styles.arrayItem}>
              {typeof item === 'object' && item !== null
                ? Object.entries(item).map(([k, v]) =>
                    renderDataField(k, v, level + 2),
                  )
                : renderDataField(`${index}`, item, level + 1)}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View
        key={key}
        style={[styles.fieldContainer, {paddingLeft: level * 16}]}>
        <Text style={styles.fieldKey}>{key}:</Text>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary[500]} />
          <Text style={styles.loadingText}>Loading observation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!observation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Observation not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSynced =
    observation.syncedAt &&
    observation.syncedAt.getTime() > new Date('1980-01-01').getTime();
  const data =
    typeof observation.data === 'string'
      ? JSON.parse(observation.data)
      : observation.data;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.brand.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Observation Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionButton}>
            <Icon name="pencil" size={24} color={colors.brand.primary[500]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
            <Icon name="delete" size={24} color={colors.semantic.error[500]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Form Type:</Text>
            <Text style={styles.infoValue}>
              {formName || observation.formType}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Observation ID:</Text>
            <Text style={[styles.infoValue, styles.monoText]}>
              {observation.observationId}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>
              {observation.createdAt.toLocaleString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Updated:</Text>
            <Text style={styles.infoValue}>
              {observation.updatedAt.toLocaleString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View
              style={[
                styles.statusBadge,
                isSynced ? styles.syncedBadge : styles.pendingBadge,
              ]}>
              <Icon
                name={isSynced ? 'check-circle' : 'clock-outline'}
                size={16}
                color={
                  isSynced
                    ? colors.semantic.success[500]
                    : colors.semantic.warning[500]
                }
              />
              <Text style={styles.statusText}>
                {isSynced ? 'Synced' : 'Pending'}
              </Text>
            </View>
          </View>
          {isSynced && observation.syncedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Synced At:</Text>
              <Text style={styles.infoValue}>
                {observation.syncedAt.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {observation.geolocation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Latitude:</Text>
              <Text style={styles.infoValue}>
                {typeof observation.geolocation === 'string'
                  ? JSON.parse(observation.geolocation).latitude
                  : observation.geolocation.latitude}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Longitude:</Text>
              <Text style={styles.infoValue}>
                {typeof observation.geolocation === 'string'
                  ? JSON.parse(observation.geolocation).longitude
                  : observation.geolocation.longitude}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Form Data</Text>
          <View style={styles.dataContainer}>
            {Object.entries(data).map(([key, value]) =>
              renderDataField(key, value),
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[900],
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral[900],
    flex: 1,
    textAlign: 'right',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  syncedBadge: {
    backgroundColor: colors.semantic.success[50],
  },
  pendingBadge: {
    backgroundColor: colors.semantic.warning[50],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[900],
  },
  dataContainer: {
    marginTop: 8,
  },
  fieldContainer: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  fieldKey: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary[500],
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.neutral[900],
    marginLeft: 8,
  },
  arrayItem: {
    marginLeft: 16,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.semantic.error[500],
  },
});

export default ObservationDetailScreen;
