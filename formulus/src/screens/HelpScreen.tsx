import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';

const HelpScreen: React.FC = () => {
  const { themeColors } = useAppTheme();
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
            Help & Support
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
            Get help and share feedback
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
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
              Community Forum
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
            We would love to hear your feedback and welcome contributions.
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
              Troubleshooting
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If something is not working as expected:
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              1. Check your internet connection.
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              2. Try syncing again from the Sync tab.
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              3. If the issue persists, reach out via the forum.
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
              Administrator
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              For account setup, server configuration, or access issues, contact
              your system administrator.
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

export default HelpScreen;
