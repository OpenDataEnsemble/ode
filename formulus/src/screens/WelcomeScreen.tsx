import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { colors } from '../theme/colors';
import { Button } from '../components/common';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import logo from '../../assets/images/logo.png';

type WelcomeScreenNavigationProp = StackNavigationProp<MainAppStackParamList>;

type Tokens = {
  border: { width: { thin: string }; radius: { full: string } };
  spacing: Record<string, string>;
  font: {
    size: Record<string, string>;
    weight: { regular: string; bold: string };
  };
  logo: { xl: string };
};

const t = tokens as Tokens;

const parsePx = (value: string | undefined): number =>
  parseInt(String(value ?? '').replace('px', ''), 10) || 0;

const ode = {
  borderWidthThin: parsePx(t.border?.width?.thin) || 1,
  radiusFull: parsePx(t.border?.radius?.full) || 9999,
  logoSize: parsePx(t.logo?.xl) || 200,
  spacing: {
    _1: parsePx(t.spacing?.['1']) || 4,
    _2: parsePx(t.spacing?.['2']) || 8,
    _3: parsePx(t.spacing?.['3']) || 12,
    _8: parsePx(t.spacing?.['8']) || 32,
    _10: parsePx(t.spacing?.['10']) || 40,
  },
  font: {
    sizeBase: parsePx(t.font?.size?.base) || 16,
    sizeXl: parsePx(t.font?.size?.xl) || 20,
    size3xl: parsePx(t.font?.size?.['3xl']) || 32,
    weightRegular: (t.font?.weight?.regular ?? '400') as '400',
    weightBold: (t.font?.weight?.bold ?? '700') as '700',
  },
};

const WelcomeScreen = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const isDark = resolvedMode === 'dark';

  const handleGetStarted = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp' }],
    });
  };

  const odeGreen = colors.brand.primary[500];
  const logoBorderColor = isDark ? colors.brand.primary[400] : odeGreen;
  const textPrimary = isDark ? colors.neutral.white : colors.neutral.black;
  const textSecondary = isDark ? colors.neutral[400] : colors.neutral[600];

  return (
    <View style={shellStyle}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View
            style={[
              styles.logoWrapper,
              {
                borderColor: logoBorderColor,
                borderWidth: ode.borderWidthThin,
                width: ode.logoSize,
                height: ode.logoSize,
                borderRadius: ode.radiusFull,
                marginBottom: ode.spacing._10,
              },
            ]}>
            <Image
              source={logo}
              style={[
                styles.logo,
                { width: ode.logoSize, height: ode.logoSize },
              ]}
              resizeMode="contain"
            />
          </View>
          <Text
            style={[
              styles.welcomeLine,
              {
                color: textPrimary,
                fontSize: ode.font.sizeXl,
                fontWeight: ode.font.weightRegular,
                marginBottom: ode.spacing._1,
              },
            ]}>
            Welcome to:
          </Text>
          <Text
            style={[
              styles.productName,
              {
                color: odeGreen,
                fontSize: ode.font.size3xl,
                fontWeight: ode.font.weightBold,
                marginBottom: ode.spacing._3,
              },
            ]}>
            FORMULUS
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: textSecondary,
                fontSize: ode.font.sizeBase,
                marginBottom: ode.spacing._8,
              },
            ]}>
            Configure your server in under 2 minutes!
          </Text>
          <View style={[styles.buttonContainer, { marginTop: ode.spacing._2 }]}>
            <Button
              title="Get Started"
              onPress={handleGetStarted}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ode.spacing._10,
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {},
  welcomeLine: {
    textAlign: 'center',
  },
  productName: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  buttonContainer: {
    alignSelf: 'center',
    maxWidth: 320,
  },
});

export default WelcomeScreen;
