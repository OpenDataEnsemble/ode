import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Button from './Button';

export type SyncStatus = 'all' | 'synced' | 'pending';

interface SyncStatusButtonsProps {
  selectedStatus: SyncStatus;
  onStatusChange: (status: SyncStatus) => void;
  containerStyle?: ViewStyle;
}

const SyncStatusButtons: React.FC<SyncStatusButtonsProps> = ({
  selectedStatus,
  onStatusChange,
  containerStyle,
}) => {
  const buttons: { id: SyncStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'synced', label: 'Synced' },
    { id: 'pending', label: 'Pending' },
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      {buttons.map((button, index) => {
        const isActive = selectedStatus === button.id;
        const position =
          index === 0
            ? 'left'
            : index === buttons.length - 1
              ? 'right'
              : 'middle';
        return (
          <Button
            key={button.id}
            title={button.label}
            onPress={() => onStatusChange(button.id)}
            variant="primary"
            size="small"
            position={position}
            active={isActive}
            style={styles.button}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    maxWidth: 300,
    alignSelf: 'center',
  },
  button: {
    flex: 1,
  },
});

export default SyncStatusButtons;
