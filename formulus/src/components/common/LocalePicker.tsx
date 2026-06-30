import React, { useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useTranslation } from 'react-i18next';
import {
  UI_LOCALE_PREFERENCE_OPTIONS,
  type UiLocalePreference,
} from '../../lib/locale';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { odeSpacing, odeTypography, odeRadius } from '../../theme/odeDesign';
interface LocalePickerProps {
  value: UiLocalePreference;
  onChange: (value: UiLocalePreference) => void;
}

const LocalePicker: React.FC<LocalePickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const labels: Record<UiLocalePreference, string> = {
    auto: t('settings.language.auto'),
    en: t('settings.language.en'),
    pt: t('settings.language.pt'),
    fr: t('settings.language.fr'),
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: themeColors.divider as string,
            backgroundColor: themeColors.surface as string,
          },
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('settings.language.label')}>
        <Text
          style={[
            styles.triggerText,
            { color: themeColors.onSurface as string },
          ]}
          numberOfLines={1}>
          {labels[value]}
        </Text>
        <Icon
          name="chevron-down"
          size={20}
          color={themeColors.onSurface as string}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: themeColors.surface as string,
                borderColor: themeColors.divider as string,
              },
            ]}
            onPress={e => e.stopPropagation()}>
            <Text
              style={[
                styles.sheetTitle,
                { color: themeColors.onSurface as string },
              ]}>
              {t('settings.language.label')}
            </Text>
            {UI_LOCALE_PREFERENCE_OPTIONS.map(opt => {
              const selected = value === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.option,
                    selected && {
                      backgroundColor: themeColors.primaryLight as string,
                    },
                  ]}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: selected
                          ? (themeColors.primary as string)
                          : (themeColors.onSurface as string),
                      },
                    ]}>
                    {labels[opt.value]}
                  </Text>
                  {selected ? (
                    <Icon
                      name="check"
                      size={20}
                      color={themeColors.primary as string}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: odeRadius.inner,
    paddingHorizontal: odeSpacing.sm,
    paddingVertical: odeSpacing.xs,
    gap: odeSpacing.xs,
  },
  triggerText: {
    flex: 1,
    fontSize: odeTypography.bodySm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: odeSpacing.lg,
  },
  sheet: {
    borderRadius: odeRadius.card,
    borderWidth: 1,
    paddingVertical: odeSpacing.sm,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    paddingHorizontal: odeSpacing.md,
    paddingVertical: odeSpacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: odeSpacing.md,
    paddingVertical: odeSpacing.sm,
  },
  optionText: {
    fontSize: odeTypography.body,
    flex: 1,
  },
});

export default LocalePicker;
