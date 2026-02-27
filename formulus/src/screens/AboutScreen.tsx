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
import { withAlpha, CONTAINER_ALPHA } from '../theme/colors';
import { appVersionService } from '../services/AppVersionService';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import logo from '../../assets/images/logo.png';

const AboutScreen: React.FC = () => {
  const { themeColors } = useAppTheme();
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
              backgroundColor: withAlpha(
                themeColors.surface as string,
                CONTAINER_ALPHA,
              ),
              borderWidth: 1,
              borderBottomWidth: 1,
              borderColor: themeColors.divider as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: themeColors.onSurface }]}>
            About
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
            Information about this app
          </Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <View style={styles.brandText}>
              <Text style={[styles.appName, { color: themeColors.onSurface }]}>
                ODE
              </Text>
              {!!version && (
                <Text style={[styles.version, { color: themeColors.onSurface }]}>
                  v{version}
                </Text>
              )}
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
                style={[styles.cardTitle, { color: themeColors.onSurface }]}>
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
                style={[styles.cardTitle, { color: themeColors.onSurface }]}>
                Support
              </Text>
              <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
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
                style={[styles.cardTitle, { color: themeColors.onSurface }]}>
                Free & Open Source
              </Text>
              <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 56,
    height: 56,
  },
  brandText: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
  },
  version: {
    marginTop: 2,
    fontSize: 12,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardInner: {
    borderRadius: 8,
    overflow: 'hidden',
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    marginTop: 12,
    fontWeight: '600',
  },
});

export default AboutScreen;
