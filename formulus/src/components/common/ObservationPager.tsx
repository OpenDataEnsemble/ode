import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { odeSpacing, odeTypography, odeRadius } from '../../theme/odeDesign';
import { buildObservationPagerItems } from '../../database/observationListQuery';

type ObservationPagerProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const ObservationPager: React.FC<ObservationPagerProps> = ({
  page,
  totalPages,
  onPageChange,
}) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const items = buildObservationPagerItems(page, totalPages);
  const onSurface = themeColors.onSurface as string;
  const primary = themeColors.primary as string;

  return (
    <View style={styles.row} accessibilityRole="adjustable">
      {items.map((item, index) => {
        if (item.kind === 'ellipsis') {
          return (
            <Text
              key={`e-${index}`}
              style={[styles.item, { color: onSurface }]}>
              …
            </Text>
          );
        }
        if (item.kind === 'prev' || item.kind === 'next') {
          const label = item.kind === 'prev' ? '<' : '>';
          return (
            <Pressable
              key={item.kind}
              onPress={() => onPageChange(item.page)}
              disabled={item.disabled}
              accessibilityRole="button"
              accessibilityLabel={
                item.kind === 'prev'
                  ? t('observations.pagerPrev')
                  : t('observations.pagerNext')
              }
              style={styles.hit}>
              <Text
                style={[
                  styles.item,
                  {
                    color: item.disabled ? onSurface : primary,
                    opacity: item.disabled ? 0.35 : 1,
                  },
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        }
        if (item.current) {
          return (
            <Text
              key={`p-${item.page}`}
              style={[styles.item, styles.current, { color: onSurface }]}
              accessibilityState={{ selected: true }}>
              {item.page}
            </Text>
          );
        }
        return (
          <Pressable
            key={`p-${item.page}`}
            onPress={() => onPageChange(item.page)}
            accessibilityRole="button"
            accessibilityLabel={t('observations.pagerPage', {
              page: item.page,
            })}
            style={styles.hit}>
            <Text style={[styles.item, { color: primary }]}>{item.page}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: odeSpacing.sm,
    paddingVertical: odeSpacing.sm,
  },
  hit: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: odeRadius.inner,
  },
  item: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    paddingHorizontal: odeSpacing.xs,
  },
  current: {
    textDecorationLine: 'none',
  },
});

export default ObservationPager;
