import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { Observation } from '../../database/models/Observation';
import colors from '../../theme/colors';
import Button from './Button';
import { useAppTheme } from '../../contexts/AppThemeContext';

interface ObservationCardProps {
  observation: Observation;
  formName?: string;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ObservationCard: React.FC<ObservationCardProps> = ({
  observation,
  formName,
  onPress,
  onEdit,
  onDelete,
}) => {
  const { themeColors } = useAppTheme();
  const isSynced =
    observation.syncedAt &&
    observation.syncedAt.getTime() > new Date('1980-01-01').getTime();
  const dateStr = observation.createdAt.toLocaleDateString();
  const timeStr = observation.createdAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getDataPreview = () => {
    try {
      const data =
        typeof observation.data === 'string'
          ? JSON.parse(observation.data)
          : observation.data;
      const keys = Object.keys(data).slice(0, 2);
      if (keys.length === 0) return 'No data';
      return keys
        .map(key => `${key}: ${String(data[key]).substring(0, 20)}`)
        .join(', ');
    } catch {
      return 'No data';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name={isSynced ? 'check-circle' : 'clock-outline'}
            size={24}
            color={
              isSynced
                ? colors.semantic.success[500]
                : colors.semantic.warning[500]
            }
          />
        </View>
        <View style={styles.textContainer}>
          {formName && (
            <Text style={[styles.formName, { color: themeColors.primary }]}>
              {formName}
            </Text>
          )}
          <Text style={styles.id} numberOfLines={1}>
            ID: {observation.observationId.substring(0, 20)}...
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {getDataPreview()}
          </Text>
          <View style={styles.metaContainer}>
            <Text style={styles.date}>
              {dateStr} at {timeStr}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isSynced ? styles.syncedBadge : styles.pendingBadge,
              ]}>
              <Text style={styles.statusText}>
                {isSynced ? 'Synced' : 'Pending'}
              </Text>
            </View>
          </View>
          <Text style={styles.owner} numberOfLines={1}>
            {`By ${
              observation.author && observation.author.trim().length > 0
                ? observation.author
                : 'Unknown'
            } • ${
              observation.deviceId && observation.deviceId.trim().length > 0
                ? observation.deviceId.slice(-8)
                : 'no-device'
            }`}
          </Text>
        </View>
        <View style={styles.actions}>
          {onEdit && (
            <Button
              title="Edit"
              onPress={onEdit}
              variant="primary"
              size="small"
              position="left"
            />
          )}
          {onDelete && (
            <Button
              title="Delete"
              onPress={onDelete}
              variant="danger"
              size="small"
              position="right"
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  formName: {
    fontSize: 14,
    fontWeight: '600',
    // color is applied inline via themeColors.primary
    marginBottom: 4,
  },
  id: {
    fontSize: 12,
    color: colors.neutral[500],
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  preview: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  owner: {
    marginTop: 6,
    fontSize: 12,
    color: colors.neutral[500],
  },
  date: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncedBadge: {
    backgroundColor: colors.semantic.success[50],
  },
  pendingBadge: {
    backgroundColor: colors.semantic.warning[50],
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[900],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});

export default ObservationCard;
