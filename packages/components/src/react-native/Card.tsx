/**
 * ODE Card Component - React Native
 * 
 * Modern minimalist card with subtle elevation and clean styling
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { CardProps } from '../shared/types';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  elevated = true,
  style,
  onPress,
  testID,
}) => {
  const borderRadius = parseInt(tokens.border.radius.lg.replace('px', ''));

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderRadius,
          backgroundColor: tokens.color.neutral.white,
          ...(elevated && {
            shadowColor: tokens.color.neutral.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }),
          borderWidth: 1,
          borderColor: tokens.color.neutral[200],
        },
        style,
      ]}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: parseInt(tokens.spacing[6].replace('px', '')),
  },
  title: {
    fontSize: parseInt(tokens.font.size.xl.replace('px', '')),
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.neutral[900],
    marginBottom: parseInt(tokens.spacing[2].replace('px', '')),
    fontFamily: tokens.font.family.sans,
    lineHeight: parseFloat(tokens.font.lineHeight.tight),
  },
  subtitle: {
    fontSize: parseInt(tokens.font.size.sm.replace('px', '')),
    fontWeight: tokens.font.weight.regular,
    color: tokens.color.neutral[600],
    marginBottom: parseInt(tokens.spacing[4].replace('px', '')),
    fontFamily: tokens.font.family.sans,
    lineHeight: parseFloat(tokens.font.lineHeight.normal),
  },
});

export default Card;
