import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import colors from '../theme/colors';

const HelpScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>Get help and share feedback</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Community Forum</Text>
          <Text style={styles.cardText}>
            We would love to hear your feedback and welcome contributions.
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Troubleshooting</Text>
          <Text style={styles.cardText}>
            If something is not working as expected:
          </Text>
          <Text style={styles.cardText}>
            1. Check your internet connection.
          </Text>
          <Text style={styles.cardText}>
            2. Try syncing again from the Sync tab.
          </Text>
          <Text style={styles.cardText}>
            3. If the issue persists, reach out via the forum.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Administrator</Text>
          <Text style={styles.cardText}>
            For account setup, server configuration, or access issues, contact
            your system administrator.
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

export default HelpScreen;
