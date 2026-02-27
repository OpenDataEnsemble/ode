import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors, { withAlpha, CONTAINER_ALPHA } from '../theme/colors';
import { appVersionService } from '../services/AppVersionService';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';
import logo from '../../assets/images/logo.png';

const AboutScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const titleColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardTitleColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const [version, setVersion] = useState<string>('');
  const cardOuterBg = withAlpha(
    themeColors.surface as string,
    CONTAINER_ALPHA,
  );
  const cardInnerBg = withAlpha(
    themeColors.surface as string,
    CONTAINER_ALPHA,
  );

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const v = await appVersionService.getFullVersion();
        setVersion(v);
      } catch {
        setVersion('');
      }
    };

    loadVersion();
  }, []);

  return (
    <BlurredScreenBackground>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark
                ? (themeColors.surface as string)
                : (colors.neutral[50] as string),
              borderWidth: 1,
              borderBottomWidth: 1,
              borderColor: themeColors.divider as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: titleColor }]}>About</Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.logoWrapper}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.brandText}>
              <Text style={[styles.appName, { color: themeColors.onSurface }]}>
                ODE
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View
              style={[
                styles.cardInner,
                { backgroundColor: cardInnerBg },
              ]}>
              <Text
                style={[styles.cardTitle, { color: cardTitleColor }]}>
                Formulus
              </Text>
              <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
                Formulus is the mobile app for collecting and synchronizing forms
                and observations.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View
              style={[
                styles.cardInner,
                { backgroundColor: cardInnerBg },
              ]}>
              <Text
                style={[styles.cardTitle, { color: cardTitleColor }]}>
                Support
              </Text>
              <Text
                style={[
                  styles.cardText,
                  { color: themeColors.onSurface },
                ]}>
                If you need help, contact your system administrator.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View
              style={[
                styles.cardInner,
                { backgroundColor: cardInnerBg },
              ]}>
              <Text
                style={[styles.cardTitle, { color: cardTitleColor }]}>
                Free & Open Source
              </Text>
              <Text
                style={[
                  styles.cardText,
                  { color: themeColors.onSurface },
                ]}>
                This application is free and open source software. We would love
                to hear your feedback and welcome contributions.
              </Text>
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}
                onPress={() =>
                  Linking.openURL('https://forum.opendataensemble.org')
                }
                suppressHighlighting={true}>
                https://forum.opendataensemble.org
              </Text>
            </View>
          </View>

          {!!version && (
            <Text style={[styles.version, { color: themeColors.onSurface }]}>
              v{version}
            </Text>
          )}
      </ScrollView>
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollTransparent: {
    backgroundColor: 'transparent',
  },
  header: {
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    borderBottomLeftRadius: odeRadius.card,
    borderBottomRightRadius: odeRadius.card,
    overflow: 'hidden',
    alignItems: 'center',
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'center',
  },
  content: {
    padding: odeSpacing.md,
    paddingBottom: odeSpacing.xl,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: odeSpacing.md,
    gap: odeSpacing.xs,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.brand.primary[500] as string,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 56,
    height: 56,
    backgroundColor: 'transparent',
  },
  brandText: {
    alignItems: 'center',
  },
  appName: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  version: {
    marginTop: odeSpacing.xxs,
    fontSize: odeTypography.caption,
    textAlign: 'center',
  },
  card: {
    borderRadius: odeRadius.card,
    marginBottom: odeSpacing.sm,
    borderWidth: odeBorderWidth.hairline,
    padding: odeSpacing.md,
  },
  cardInner: {
    borderRadius: odeRadius.inner,
    overflow: 'hidden',
    padding: odeSpacing.sm,
  },
  cardTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: odeSpacing.xs,
    textAlign: 'center',
  },
  cardText: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
    textAlign: 'center',
  },
  link: {
    marginTop: odeSpacing.sm,
    fontWeight: '600',
  },
});

export default AboutScreen;
