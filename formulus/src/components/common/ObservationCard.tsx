import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { Observation } from '../../database/models/Observation';
import colors from '../../theme/colors';
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

  const cardBg = themeColors.surface as string;
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderWidth: 1,
          borderColor: themeColors.divider as string,
          backgroundColor: cardBg,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name={isSynced ? 'check-circle' : 'clock-outline'}
            size={24}
            color={
              isSynced
                ? (themeColors.primary as string)
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
            <TouchableOpacity
              onPress={onEdit}
              accessibilityLabel="Edit observation"
              style={styles.iconButton}>
              <Icon
                name="pencil"
                size={20}
                color={themeColors.primary as string}
              />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              accessibilityLabel="Delete observation"
              style={styles.iconButton}>
              <Icon
                name="trash-can"
                size={20}
                color={colors.semantic.error[500] as string}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
});

export default ObservationCard;
