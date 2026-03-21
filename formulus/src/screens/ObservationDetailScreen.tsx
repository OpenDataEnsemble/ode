import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { Observation } from '../database/models/Observation';
import { FormService } from '../services/FormService';
import {
  hasMeaningfulSyncedAt,
  isObservationFullySynced,
} from '../utils/observationSyncStatus';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import { Button } from '../components/common';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeRadius,
  odeScreenHeaderHeight,
  odeBorderWidth,
} from '../theme/odeDesign';

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
  const { observationId } = route.params;
  const navigation = useNavigation();
  const { themeColors } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const { showConfirm } = useConfirmModal();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  /** Matches Observation Details header bottom border (hairline + theme divider). */
  const formDataRowSeparatorStyle = {
    borderBottomWidth: odeBorderWidth.hairline,
    borderBottomColor: themeColors.divider as string,
  };

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

    showConfirm({
      title: 'Delete Observation',
      message:
        'Are you sure you want to delete this observation? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', onPress: () => {}, variant: 'tertiary' },
        {
          text: 'Delete',
          variant: 'danger',
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
    });
  };

  const renderDataField = (key: string, value: unknown, level: number = 0) => {
    const fieldKeyStyle = [styles.fieldKey, { color: themeColors.primary }];

    if (value === null || value === undefined) {
      return (
        <View
          key={key}
          style={[
            styles.fieldContainer,
            formDataRowSeparatorStyle,
            { paddingLeft: level * 16 },
          ]}>
          <Text style={fieldKeyStyle}>{key}:</Text>
          <Text style={[styles.fieldValue, { color: themeColors.onSurface }]}>
            null
          </Text>
        </View>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <View
          key={key}
          style={[
            styles.fieldContainer,
            formDataRowSeparatorStyle,
            { paddingLeft: level * 16 },
          ]}>
          <Text style={fieldKeyStyle}>{key}:</Text>
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
          style={[
            styles.fieldContainer,
            formDataRowSeparatorStyle,
            { paddingLeft: level * 16 },
          ]}>
          <Text style={fieldKeyStyle}>{key}:</Text>
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
        style={[
          styles.fieldContainer,
          formDataRowSeparatorStyle,
          { paddingLeft: level * 16 },
        ]}>
        <Text style={fieldKeyStyle}>{key}:</Text>
        <Text style={[styles.fieldValue, { color: themeColors.onSurface }]}>
          {String(value)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text
              style={[styles.loadingText, { color: themeColors.onBackground }]}>
              Loading observation...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!observation) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Observation not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isSynced = isObservationFullySynced(observation);
  const data =
    typeof observation.data === 'string'
      ? JSON.parse(observation.data)
      : observation.data;

  const sectionBg = themeColors.surface as string;
  const sectionStyle = [
    styles.section,
    {
      borderColor: themeColors.divider as string,
      backgroundColor: sectionBg,
    },
  ];
  const onSurface = { color: themeColors.onSurface as string };

  return (
    <View style={shellStyle}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingTop: odeScreenHeaderHeight + odeSpacing.md,
            },
          ]}>
          <View style={styles.actionBar}>
            <Button
              title="Edit"
              onPress={handleEdit}
              variant="primary"
              size="small"
              position="left"
            />
            <Button
              title="Delete"
              onPress={handleDelete}
              variant="danger"
              size="small"
              position="right"
            />
          </View>
          <View style={sectionStyle}>
            <Text style={[styles.sectionTitle, onSurface]}>
              Basic Information
            </Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Form Type:</Text>
              <Text style={[styles.infoValue, onSurface]}>
                {formName || observation.formType}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Observation ID:</Text>
              <Text style={[styles.infoValue, styles.monoText, onSurface]}>
                {observation.observationId}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Created:</Text>
              <Text style={[styles.infoValue, onSurface]}>
                {observation.createdAt.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Updated:</Text>
              <Text style={[styles.infoValue, onSurface]}>
                {observation.updatedAt.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Status:</Text>
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
                      ? (themeColors.primary as string)
                      : (colors.semantic.warning[500] as unknown as string)
                  }
                />
                <Text style={styles.statusText}>
                  {isSynced ? 'Synced' : 'Pending'}
                </Text>
              </View>
            </View>
            {hasMeaningfulSyncedAt(observation.syncedAt) &&
              observation.syncedAt && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, onSurface]}>
                    {isSynced ? 'Synced at:' : 'Last synced:'}
                  </Text>
                  <Text style={[styles.infoValue, onSurface]}>
                    {observation.syncedAt.toLocaleString()}
                  </Text>
                </View>
              )}
          </View>

          {observation.geolocation && (
            <View style={sectionStyle}>
              <Text style={[styles.sectionTitle, onSurface]}>Location</Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, onSurface]}>Latitude:</Text>
                <Text style={[styles.infoValue, onSurface]}>
                  {typeof observation.geolocation === 'string'
                    ? JSON.parse(observation.geolocation).latitude
                    : observation.geolocation.latitude}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, onSurface]}>Longitude:</Text>
                <Text style={[styles.infoValue, onSurface]}>
                  {typeof observation.geolocation === 'string'
                    ? JSON.parse(observation.geolocation).longitude
                    : observation.geolocation.longitude}
                </Text>
              </View>
            </View>
          )}

          <View style={sectionStyle}>
            <Text style={[styles.sectionTitle, onSurface]}>Ownership</Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Author:</Text>
              <Text style={[styles.infoValue, onSurface]}>
                {observation.author && observation.author.trim().length > 0
                  ? observation.author
                  : 'Unknown'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, onSurface]}>Device ID:</Text>
              <Text style={[styles.infoValue, styles.monoText, onSurface]}>
                {observation.deviceId && observation.deviceId.trim().length > 0
                  ? observation.deviceId
                  : 'Unknown'}
              </Text>
            </View>
          </View>

          <View style={sectionStyle}>
            <Text style={[styles.sectionTitle, onSurface]}>Form Data</Text>
            <View style={styles.dataContainer}>
              {Object.entries(data).map(([key, value]) =>
                renderDataField(key, value),
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: odeSpacing.xs,
    // No extra top margin: gap below header comes from contentContainer paddingTop.
    marginTop: 0,
    marginBottom: odeSpacing.md,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: odeSpacing.md,
  },
  section: {
    borderRadius: odeRadius.card,
    padding: odeSpacing.md,
    marginHorizontal: 0,
    marginBottom: odeSpacing.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: odeSpacing.sm,
    textAlign: 'left',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: odeSpacing.sm,
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
    paddingVertical: odeSpacing.xxs,
    borderRadius: 12,
    gap: odeSpacing.xxs,
  },
  syncedBadge: {
    backgroundColor: colors.semantic.success[50] as unknown as string,
  },
  pendingBadge: {
    backgroundColor: colors.semantic.warning[50] as unknown as string,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[900],
  },
  dataContainer: {
    marginTop: odeSpacing.xs,
  },
  fieldContainer: {
    marginBottom: odeSpacing.xs,
    paddingBottom: odeSpacing.xs,
    alignSelf: 'stretch',
  },
  fieldKey: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: odeSpacing.xxs,
    textAlign: 'left',
  },
  fieldValue: {
    fontSize: 14,
    color: colors.neutral[900],
    marginLeft: 8,
    textAlign: 'left',
  },
  arrayItem: {
    marginLeft: odeSpacing.md,
    marginTop: odeSpacing.xxs,
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
    color: colors.semantic.error[500] as unknown as string,
  },
});

export default ObservationDetailScreen;
