import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import colors from '../../theme/colors';

export type SyncStatus = 'all' | 'synced' | 'pending';

interface SyncStatusButtonsProps {
  selectedStatus: SyncStatus;
  onStatusChange: (status: SyncStatus) => void;
}

const SyncStatusButtons: React.FC<SyncStatusButtonsProps> = ({
  selectedStatus,
  onStatusChange,
}) => {
  const buttons: {id: SyncStatus; label: string}[] = [
    {id: 'all', label: 'All'},
    {id: 'synced', label: 'Synced'},
    {id: 'pending', label: 'Pending'},
  ];

  return (
    <View style={styles.container}>
      {buttons.map(button => {
        const isActive = selectedStatus === button.id;
        return (
          <TouchableOpacity
            key={button.id}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => onStatusChange(button.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.buttonText, isActive && styles.buttonTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {button.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: 8,
    padding: 4,
    gap: 4,
    flex: 1,
    maxWidth: 300,
    alignSelf: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: colors.neutral.white,
    shadowColor: colors.neutral.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[600],
    textAlign: 'center',
  },
  buttonTextActive: {
    color: colors.brand.primary[500],
    fontWeight: '600',
  },
});

export default SyncStatusButtons;

