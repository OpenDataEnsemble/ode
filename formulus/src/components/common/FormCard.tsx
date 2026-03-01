import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { FormSpec } from '../../services/FormService';
import colors, { withAlpha, CONTAINER_ALPHA } from '../../theme/colors';
import { useAppTheme } from '../../contexts/AppThemeContext';

interface FormCardProps {
  form: FormSpec;
  observationCount?: number;
  onPress: () => void;
}

const FormCard: React.FC<FormCardProps> = ({
  form,
  observationCount = 0,
  onPress,
}) => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const formTitleColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);

  const cardOuterBg = withAlpha(themeColors.surface as string, CONTAINER_ALPHA);
  const cardInnerBg = withAlpha(themeColors.surface as string, CONTAINER_ALPHA);
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderWidth: 1,
          borderColor: themeColors.divider as string,
          backgroundColor: cardOuterBg,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={[styles.cardInner, { backgroundColor: cardInnerBg }]}>
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: themeColors.primary + '14' },
            ]}>
            <Icon
              name="file-document-outline"
              size={32}
              color={themeColors.primary}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.name, { color: formTitleColor }]}>
              {form.name}
            </Text>
            {form.description && (
              <Text style={styles.description} numberOfLines={2}>
                {form.description}
              </Text>
            )}
            <View style={styles.metaContainer}>
              <Text style={styles.version}>v{form.schemaVersion}</Text>
              {observationCount > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: themeColors.primary + '14' },
                  ]}>
                  <Text
                    style={[styles.countText, { color: themeColors.primary }]}>
                    {observationCount}{' '}
                    {observationCount === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Icon name="chevron-right" size={24} color={colors.neutral[500]} />
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
  },
  cardInner: {
    borderRadius: 8,
    overflow: 'hidden',
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // backgroundColor is applied inline via themeColors.primary + '14'
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  version: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  countBadge: {
    // backgroundColor is applied inline via themeColors.primary + '14'
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    // color is applied inline via themeColors.primary
    fontWeight: '500',
  },
});

export default FormCard;
