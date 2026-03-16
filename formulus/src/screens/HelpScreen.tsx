import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';

const FORUM_URL = 'https://forum.opendataensemble.org';

const HelpScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const sectionColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardBg = themeColors.surface as string;
  const headerBg = isDark
    ? (colors.neutral[900] as string)
    : (colors.neutral[50] as string);

  const cardStyle = [
    styles.card,
    { borderColor: themeColors.divider as string, backgroundColor: cardBg },
  ];
  const onSurface = { color: themeColors.onSurface as string };

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
          <Text style={[styles.title, { color: sectionColor }]}>
            Help & Support
          </Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Community Forum
            </Text>
            <Text style={[styles.cardText, styles.cardTextCentered, onSurface]}>
              We would love to hear your feedback and welcome contributions.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(FORUM_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open forum opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.cardTextCentered,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {FORUM_URL}
              </Text>
            </Pressable>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Troubleshooting
            </Text>
            <Text style={[styles.cardText, onSurface]}>
              If something is not working as expected:
            </Text>
            <Text style={[styles.cardText, onSurface]}>
              1. Check your internet connection.
            </Text>
            <Text style={[styles.cardText, onSurface]}>
              2. Try syncing again from the Sync tab.
            </Text>
            <Text style={[styles.cardText, onSurface]}>
              3. If the issue persists, reach out via the forum.
            </Text>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Administrator
            </Text>
            <Text
              style={[styles.cardText, styles.cardTextCentered, onSurface]}>
              For account setup, server configuration, or access issues,
              contact your system administrator.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollTransparent: { backgroundColor: 'transparent' },
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
    textAlign: 'center',
  },
  cardText: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
  },
  cardTextCentered: { textAlign: 'center' },
  link: { marginTop: odeSpacing.sm, fontWeight: '600' },
});

export default HelpScreen;
