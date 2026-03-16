/**
 * ConfirmModal – confirmation dialog.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import colors from '../../theme/colors';
import { useAppTheme } from '../../contexts/AppThemeContext';
import Button from './Button';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../../theme/odeDesign';

export interface ConfirmButton {
  text: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
}

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: ConfirmButton[];
  onRequestClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
}) => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const cardTitleColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardBg = themeColors.surface as string;

  const handlePress = (button: ConfirmButton) => {
    onRequestClose();
    button.onPress();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.backdrop}
        onPress={onRequestClose}>
        <TouchableOpacity
          style={styles.centered}
          activeOpacity={1}
          onPress={() => {}}>
          <View
            style={[
              styles.card,
              {
                borderWidth: odeBorderWidth.hairline,
                borderColor: themeColors.divider as string,
                backgroundColor: cardBg,
              },
            ]}>
            <Text style={[styles.title, { color: cardTitleColor }]}>
              {title}
            </Text>
            <Text
              style={[
                styles.message,
                { color: themeColors.onSurface as string },
              ]}>
              {message}
            </Text>
            <View style={styles.buttonsRow}>
              {buttons.map((btn, index) => (
                <Button
                  key={index}
                  title={btn.text}
                  onPress={() => handlePress(btn)}
                  variant={btn.variant ?? 'tertiary'}
                  size="medium"
                  style={styles.button}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: odeSpacing.lg,
  },
  centered: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    borderRadius: odeRadius.card,
    overflow: 'hidden',
    padding: odeSpacing.md,
  },
  title: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: odeSpacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
    marginBottom: odeSpacing.lg,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: odeSpacing.sm,
    flexWrap: 'wrap',
  },
  button: {
    minWidth: 100,
  },
});

export default ConfirmModal;
