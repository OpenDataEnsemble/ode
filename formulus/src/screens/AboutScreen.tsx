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
import colors from '../theme/colors';
import { appVersionService } from '../services/AppVersionService';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import logo from '../../assets/images/logo.png';

const AboutScreen: React.FC = () => {
  const { themeColors } = useAppTheme();
  const [version, setVersion] = useState<string>('');

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.surface,
              borderBottomColor: themeColors.divider,
            },
          ]}>
          <Text style={[styles.title, { color: themeColors.onSurface }]}>
            About
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
            Information about this app
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
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
                backgroundColor: themeColors.surface,
                shadowColor: themeColors.surface,
              },
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

          <View
            style={[
              styles.card,
              {
                backgroundColor: themeColors.surface,
                shadowColor: themeColors.surface,
              },
            ]}>
            <Text
              style={[styles.cardTitle, { color: themeColors.onSurface }]}>
              Support
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you need help, contact your system administrator.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: themeColors.surface,
                shadowColor: themeColors.surface,
              },
            ]}>
            <Text
              style={[styles.cardTitle, { color: themeColors.onSurface }]}>
              Free & Open Source
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
            This application is free and open source software. We would love to
            hear your feedback and welcome contributions.
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
      </ScrollView>
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
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
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
