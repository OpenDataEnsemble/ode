import React from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import { useColorScheme } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';
import welcomeBgLight from '../../assets/images/welcome-bg-light.png';
import welcomeBgDark from '../../assets/images/welcome-bg-dark.png';

type Tokens = {
  opacity: Record<string, string>;
  filter: { blur: Record<string, string> };
};

const t = tokens as Tokens;

const parsePx = (value: string | undefined): number =>
  parseInt(String(value ?? '').replace('px', ''), 10) || 0;

/** Same settings as Welcome/Placeholder: ODE blur and overlay. */
const backgroundConfig = {
  imageVisibility: Number(t.opacity?.['30']) ?? 0.3,
  blurRadiusLight: parsePx(t.filter?.blur?.['4']) || 4,
  blurRadiusDark: parsePx(t.filter?.blur?.['7']) || 7,
};

/** Dark mode only: subtle edge-darkening overlay to remove bright vignette from asset. */
const EdgeDarkeningOverlay = () => {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="edgeDarken"
            cx="50%"
            cy="50%"
            r="70%"
            fx="50%"
            fy="50%">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.22" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#edgeDarken)" />
      </Svg>
    </View>
  );
};

interface BlurredScreenBackgroundProps {
  children: React.ReactNode;
}

/**
 * Shared blurred background for Welcome, Placeholder, Forms, Observations,
 * Sync, About, Help, Settings. Uses welcome-bg-light / welcome-bg-dark with
 * ODE blur and overlay; dark mode adds a subtle edge-darkening to remove
 * bright vignette from the asset.
 */
const BlurredScreenBackground: React.FC<BlurredScreenBackgroundProps> = ({
  children,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundImage: ImageSourcePropType = isDark
    ? welcomeBgDark
    : welcomeBgLight;
  const overlayColor = isDark ? colors.neutral.black : colors.neutral.white;
  const blurRadius = isDark
    ? backgroundConfig.blurRadiusDark
    : backgroundConfig.blurRadiusLight;

  return (
    <View style={[styles.root, { backgroundColor: 'transparent' }]}>
      <ImageBackground
        source={backgroundImage}
        style={styles.background}
        resizeMode="cover"
        blurRadius={blurRadius}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: overlayColor,
              opacity: 1 - backgroundConfig.imageVisibility,
            },
          ]}
        />
        {isDark && <EdgeDarkeningOverlay />}
        <View style={styles.contentSlot}>{children}</View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  contentSlot: {
    flex: 1,
  },
});

export default BlurredScreenBackground;
