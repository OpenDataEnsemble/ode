import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Image, ScrollView, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import colors from '../theme/colors';
import {appVersionService} from '../services/AppVersionService';

const AboutScreen: React.FC = () => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const v = await appVersionService.getFullVersion();
        setVersion(v);
      } catch (_e) {
        setVersion('');
      }
    };

    loadVersion();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>About</Text>
        <Text style={styles.subtitle}>Information about this app</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandText}>
            <Text style={styles.appName}>ODE</Text>
            {!!version && <Text style={styles.version}>v{version}</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Formulus</Text>
          <Text style={styles.cardText}>
            Formulus is the mobile app for collecting and synchronizing forms
            and observations.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardText}>
            If you need help, contact your system administrator.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Free & Open Source</Text>
          <Text style={styles.cardText}>
            This application is free and open source software. We would love to
            hear your feedback and welcome contributions.
          </Text>
          <Text
            style={[styles.cardText, styles.link]}
            onPress={() =>
              Linking.openURL('https://forum.opendataensemble.org')
            }
            suppressHighlighting={true}>
            https://forum.opendataensemble.org
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[600],
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
    color: colors.neutral[900],
  },
  version: {
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[600],
  },
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.neutral.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  link: {
    color: colors.brand.primary[500],
    marginTop: 12,
    fontWeight: '600',
  },
});

export default AboutScreen;
