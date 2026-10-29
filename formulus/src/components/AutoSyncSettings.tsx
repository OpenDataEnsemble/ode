import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../contexts/AppThemeContext';
import {
  AUTO_SYNC_INTERVALS,
  type AutoSyncInterval,
  loadAutoSyncSettings,
  saveAutoSyncSettings,
} from '../services/AutoSyncSettingsService';
import { autoSyncService } from '../services/AutoSyncService';
import { ToastService } from '../services/ToastService';
import { odeSpacing, odeTypography } from '../theme/odeDesign';
import { withAlpha } from '../theme/colors';

const intervalLabelKey = (interval: AutoSyncInterval): string => {
  switch (interval) {
    case 30_000:
      return 'profiles.autoSync30Seconds';
    case 2 * 60_000:
      return 'profiles.autoSync2Minutes';
    case 5 * 60_000:
      return 'profiles.autoSync5Minutes';
    case 15 * 60_000:
      return 'profiles.autoSync15Minutes';
    case 60 * 60_000:
      return 'profiles.autoSync1Hour';
    case 24 * 60 * 60_000:
      return 'profiles.autoSync24Hours';
  }
  return 'profiles.autoSync5Minutes';
};

const AutoSyncSettings = () => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const [enabled, setEnabled] = useState(false);
  const [intervalMs, setIntervalMs] = useState<AutoSyncInterval>(5 * 60_000);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      setLoading(true);

      void loadAutoSyncSettings()
        .then(settings => {
          if (cancelled) return;

          setEnabled(settings.enabled);
          setIntervalMs(settings.intervalMs);
        })
        .catch(() => {
          if (!cancelled) {
            ToastService.showLong(t('profiles.autoSyncLoadFailed'));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [t]),
  );

  const save = async (
    nextEnabled: boolean,
    nextInterval: AutoSyncInterval,
  ): Promise<void> => {
    try {
      await saveAutoSyncSettings({
        enabled: nextEnabled,
        intervalMs: nextInterval,
      });

      autoSyncService.refresh();
    } catch {
      ToastService.showLong(t('profiles.autoSyncSaveFailed'));
    }
  };

  const handleEnabledChange = (value: boolean) => {
    setEnabled(value);
    void save(value, intervalMs);
  };

  const handleIntervalChange = (value: AutoSyncInterval) => {
    setIntervalMs(value);
    void save(enabled, value);
  };

  return (
    <View style={styles.section}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={[styles.heading, { color: themeColors.onSurface }]}>
            {t('profiles.autoSyncTitle')}
          </Text>
          <Text style={[styles.hint, { color: themeColors.onSurface }]}>
            {t('profiles.autoSyncHint')}
          </Text>
        </View>

        <Switch
          value={enabled}
          disabled={loading}
          onValueChange={handleEnabledChange}
          accessibilityLabel={t('profiles.autoSyncTitle')}
        />
      </View>

      {enabled && (
        <View style={styles.intervalSection}>
          <Text
            style={[styles.intervalTitle, { color: themeColors.onSurface }]}>
            {t('profiles.autoSyncInterval')}
          </Text>

          <View style={styles.intervalOptions}>
            {AUTO_SYNC_INTERVALS.map(interval => {
              const selected = intervalMs === interval;

              return (
                <TouchableOpacity
                  key={interval}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: loading }}
                  disabled={loading}
                  onPress={() => handleIntervalChange(interval)}
                  style={[
                    styles.intervalOption,
                    {
                      backgroundColor: withAlpha(
                        themeColors.primary as string,
                        selected ? 0.12 : 0,
                      ),
                    },
                  ]}>
                  <Text
                    style={[
                      styles.intervalText,
                      {
                        color: selected
                          ? themeColors.primary
                          : themeColors.onSurface,
                      },
                    ]}>
                    {t(intervalLabelKey(interval))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: odeSpacing.md,
    gap: odeSpacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: odeSpacing.md,
  },
  toggleText: {
    flex: 1,
  },
  heading: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
  },
  hint: {
    fontSize: odeTypography.bodySm,
    marginTop: odeSpacing.xs,
  },
  intervalSection: {
    gap: odeSpacing.sm,
  },
  intervalTitle: {
    fontSize: odeTypography.body,
    fontWeight: '600',
  },
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: odeSpacing.xs,
  },
  intervalOption: {
    borderWidth: 1,
    borderRadius: odeSpacing.xs,
    paddingHorizontal: odeSpacing.sm,
    paddingVertical: odeSpacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  intervalText: {
    fontSize: odeTypography.bodySm,
    fontWeight: '500',
  },
});

export default AutoSyncSettings;
