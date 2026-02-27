import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Icon>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'information-outline',
  title,
  message,
  actionLabel,
  onAction,
}) => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const titleColor = themeColors.onBackground;
  const messageColor = isDark
    ? colors.neutral[400]
    : themeColors.onBackground;
  const iconColor = isDark ? colors.neutral[400] : themeColors.onSurface;

  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color={iconColor} />
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
      {actionLabel && onAction && (
        <Text
          style={[styles.actionText, { color: themeColors.primary }]}
          onPress={onAction}>
          {actionLabel}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionText: {
    fontSize: 16,
    // color is applied inline via themeColors.primary
    fontWeight: '500',
    marginTop: 8,
  },
});

export default EmptyState;
