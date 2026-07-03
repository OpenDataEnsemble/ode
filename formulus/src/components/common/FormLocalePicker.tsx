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
import { FORM_LOCALE_DEFAULT } from '../../lib/formLocale';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';
import { odeSpacing, odeTypography, odeRadius } from '../../theme/odeDesign';

interface FormLocalePickerProps {
  value: string;
  locales: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

const FormLocalePicker: React.FC<FormLocalePickerProps> = ({
  value,
  locales,
  disabled = false,
  onChange,
}) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const options = [
    { value: FORM_LOCALE_DEFAULT, label: t('settings.formsLanguage.default') },
    ...locales.map(code => ({ value: code, label: code })),
  ];

  const currentLabel =
    options.find(opt => opt.value === value)?.label ??
    (value === FORM_LOCALE_DEFAULT
      ? t('settings.formsLanguage.default')
      : value);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: themeColors.divider as string,
            backgroundColor: themeColors.surface as string,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('settings.formsLanguage.label')}
        accessibilityState={{ disabled }}>
        <Text
          style={[
            styles.triggerText,
            { color: themeColors.onSurface as string },
          ]}
          numberOfLines={1}>
          {currentLabel}
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
              {t('settings.formsLanguage.label')}
            </Text>
            {options.map(opt => {
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
                    {opt.label}
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
    backgroundColor: colors.ui.background,
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

export default FormLocalePicker;
