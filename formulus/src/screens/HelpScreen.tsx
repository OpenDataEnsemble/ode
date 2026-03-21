import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
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
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import logo from '../../assets/images/logo.png';
import { attachmentExportService } from '../services/AttachmentExportService';

const FORUM_URL = 'https://forum.opendataensemble.org';
const EMAIL_URL = 'mailto:hello@opendataensemble.org';
const GH_URL = 'https://github.com/OpenDataEnsemble';

const HelpScreen: React.FC = () => {
  const [exportingAttachments, setExportingAttachments] = useState(false);
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const sectionColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardBg = themeColors.surface as string;

  const cardStyle = [
    styles.card,
    { borderColor: themeColors.divider as string, backgroundColor: cardBg },
  ];
  const onSurface = { color: themeColors.onSurface as string };
  const mutedOnSurface = {
    color: themeColors.onSurface as string,
    opacity: 0.72,
  };

  const onExportAttachments = async () => {
    setExportingAttachments(true);
    try {
      await attachmentExportService.exportDeviceLocalAttachmentsZip();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not export attachments.';
      Alert.alert('Export failed', message);
    } finally {
      setExportingAttachments(false);
    }
  };

  return (
    <BlurredScreenBackground>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.primary as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <View style={styles.logoContainer}>
            <View
              style={[
                styles.logoWrapper,
                { borderColor: themeColors.onPrimary as string },
              ]}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text
              style={[
                styles.title,
                { color: themeColors.onPrimary as string },
              ]}>
              Help & Support
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Implementation assistance
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you are looking for professional assistance with implementing a
              project using ODE, you are more than welcome to reach out to the
              team behind ODE on our forum or via email.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(EMAIL_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open email to opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {EMAIL_URL}
              </Text>
            </Pressable>
          </View>

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
            <Text
              style={[
                styles.cardTitle,
                { color: sectionColor },
                { marginTop: odeSpacing.md },
              ]}>
              Find us on GitHub
            </Text>
            <Text style={[styles.cardText, styles.cardTextCentered, onSurface]}>
              You are also welcome to open an issue or pull request on our
              GitHub repository.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(GH_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open GitHub repository">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {GH_URL}
              </Text>
            </Pressable>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Help & Support
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you need help or support you are always welcome to try reaching
              out to our friendly community on the forum.
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

          <View style={[cardStyle, styles.exportSection]}>
            <Text style={[styles.exportHint, mutedOnSurface]}>
              Export on-device attachment files (same paths and filenames as in
              app storage, including unique ids) into a zip you can save or
              share. Does not change any data in the app.
            </Text>
            <Pressable
              onPress={onExportAttachments}
              disabled={exportingAttachments}
              accessibilityRole="button"
              accessibilityLabel="Download device-local attachment data as zip"
              accessibilityState={{ disabled: exportingAttachments }}
              style={({ pressed }) => [
                styles.exportButton,
                {
                  borderColor: themeColors.primary as string,
                  opacity: exportingAttachments ? 0.55 : pressed ? 0.85 : 1,
                },
              ]}>
              {exportingAttachments ? (
                <ActivityIndicator
                  size="small"
                  color={themeColors.primary as string}
                />
              ) : (
                <Text
                  style={[
                    styles.exportButtonText,
                    { color: themeColors.primary as string },
                  ]}>
                  Download device-local attachment data
                </Text>
              )}
            </Pressable>
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
    overflow: 'visible',
    alignItems: 'flex-start',
    minHeight: odeScreenHeaderHeight,
    width: '100%',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  content: {
    padding: odeSpacing.md,
    paddingBottom: odeSpacing.xl,
  },
  card: {
    borderRadius: odeRadius.card,
    marginBottom: odeSpacing.md,
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
  },
  cardTextCentered: { textAlign: 'left' },
  link: { marginTop: odeSpacing.sm, fontWeight: '600' },
  exportSection: {
    marginTop: odeSpacing.sm,
    paddingVertical: odeSpacing.sm,
  },
  exportHint: {
    fontSize: odeTypography.caption,
    lineHeight: 18,
    marginBottom: odeSpacing.md,
  },
  exportButton: {
    alignSelf: 'flex-start',
    paddingVertical: odeSpacing.sm,
    paddingHorizontal: odeSpacing.md,
    borderRadius: odeRadius.card,
    borderWidth: odeBorderWidth.hairline,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    fontSize: odeTypography.bodySm,
    fontWeight: '600',
  },
});

export default HelpScreen;
