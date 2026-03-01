import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors, { withAlpha, CONTAINER_ALPHA } from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';

const HelpScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const titleColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardTitleColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardOuterBg = withAlpha(themeColors.surface as string, CONTAINER_ALPHA);
  const cardInnerBg = withAlpha(themeColors.surface as string, CONTAINER_ALPHA);
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
                ? (colors.neutral[900] as string)
                : (colors.neutral[50] as string),
              borderWidth: 1,
              borderBottomWidth: 1,
              borderColor: themeColors.divider as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: titleColor }]}>
            Help & Support
          </Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View style={[styles.cardInner, { backgroundColor: cardInnerBg }]}>
              <Text style={[styles.cardTitle, { color: cardTitleColor }]}>
                Community Forum
              </Text>
              <Text
                style={[
                  styles.cardText,
                  styles.cardTextCentered,
                  { color: themeColors.onSurface },
                ]}>
                We would love to hear your feedback and welcome contributions.
              </Text>
              <Text
                style={[
                  styles.cardText,
                  styles.cardTextCentered,
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

          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View style={[styles.cardInner, { backgroundColor: cardInnerBg }]}>
              <Text style={[styles.cardTitle, { color: cardTitleColor }]}>
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
            <View style={[styles.cardInner, { backgroundColor: cardInnerBg }]}>
              <Text style={[styles.cardTitle, { color: cardTitleColor }]}>
                Administrator
              </Text>
              <Text
                style={[
                  styles.cardText,
                  styles.cardTextCentered,
                  { color: themeColors.onSurface },
                ]}>
                For account setup, server configuration, or access issues,
                contact your system administrator.
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
  },
  cardTextCentered: {
    textAlign: 'center',
  },
  link: {
    marginTop: odeSpacing.sm,
    fontWeight: '600',
  },
});

export default HelpScreen;
