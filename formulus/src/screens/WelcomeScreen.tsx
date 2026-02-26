import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { useColorScheme } from 'react-native';
import { colors } from '../theme/colors';
import { Button } from '../components/common';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';
import logo from '../../assets/images/logo.png';
import welcomeBgLight from '../../assets/images/welcome-bg-light.png';
import welcomeBgDark from '../../assets/images/welcome-bg-dark.png';

type WelcomeScreenNavigationProp = StackNavigationProp<MainAppStackParamList>;

type Tokens = {
  border: { width: { thin: string }; radius: { full: string } };
  opacity: Record<string, string>;
  spacing: Record<string, string>;
  font: { size: Record<string, string>; weight: { regular: string; bold: string } };
  logo: { xl: string };
  filter: { blur: Record<string, string> };
};

const t = tokens as Tokens;

/** Parse ODE token value in px to number for React Native. */
const parsePx = (value: string | undefined): number =>
  parseInt(String(value ?? '').replace('px', ''), 10) || 0;

/** ODE tokens for Welcome screen (all from @ode/tokens). */
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
  /** Blur by mode: light = filter.blur['4'], dark = filter.blur['7'] (a bit more blurred). */
  blurRadiusLight: parsePx(t.filter?.blur?.['4']) || 4,
  blurRadiusDark: parsePx(t.filter?.blur?.['7']) || 7,
};

/** Adjustable welcome background. Use ODE opacity tokens for consistency. */
const welcomeBackground = {
  imageVisibility: Number(t.opacity?.['30']) || 0.3,
  blurRadiusLight: ode.blurRadiusLight,
  blurRadiusDark: ode.blurRadiusDark,
  saturation: 1,
};

const WelcomeScreen = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundImage: ImageSourcePropType = isDark ? welcomeBgDark : welcomeBgLight;
  const overlayColor = isDark ? colors.neutral.black : colors.neutral.white;

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
    <View style={[styles.root, { backgroundColor: overlayColor }]}>
      <ImageBackground
        source={backgroundImage}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={isDark ? welcomeBackground.blurRadiusDark : welcomeBackground.blurRadiusLight}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: overlayColor,
              opacity: 1 - welcomeBackground.imageVisibility,
            },
          ]}
        />
      </ImageBackground>
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
            ]}
          >
            <Image
              source={logo}
              style={[styles.logo, { width: ode.logoSize, height: ode.logoSize }]}
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
            ]}
          >
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
            ]}
          >
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
            ]}
          >
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
  root: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
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
    alignSelf: 'stretch',
    maxWidth: 320,
  },
});

export default WelcomeScreen;
