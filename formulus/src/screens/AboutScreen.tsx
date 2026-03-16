import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
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

const FORUM_URL = 'https://forum.opendataensemble.org';

const AboutScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const sectionColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const [version, setVersion] = useState<string>('');
  const cardBg = themeColors.surface as string;
  const headerBg = isDark
    ? (colors.neutral[900] as string)
    : (colors.neutral[50] as string);

  const cardStyle = [
    styles.card,
    {
      borderColor: themeColors.divider as string,
      backgroundColor: cardBg,
    },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        setVersion(await appVersionService.getFullVersion());
      } catch {
        setVersion('');
      }
    };
    load();
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
              backgroundColor: headerBg,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: sectionColor }]}>About</Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.logoWrapper}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.appName, { color: themeColors.onSurface }]}>
              ODE
            </Text>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Formulus
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              Formulus is the mobile app for collecting and synchronizing forms
              and observations.
            </Text>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Support
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you need help, contact your system administrator.
            </Text>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Free & Open Source
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              This application is free and open source software. We would love
              to hear your feedback and welcome contributions.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(FORUM_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open forum opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {FORUM_URL}
              </Text>
            </Pressable>
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
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
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
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
  },
  cardText: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
    textAlign: 'left',
  },
  link: {
    marginTop: odeSpacing.sm,
    fontWeight: '600',
  },
});

export default AboutScreen;
