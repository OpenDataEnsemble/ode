import React, { useCallback, useState } from 'react';
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
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import logo from '../../assets/images/logo.png';
import { attachmentExportService } from '../services/AttachmentExportService';
import { observationExportService } from '../services/ObservationExportService';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import {
  clearDiagnosticFiles,
  exportDiagnosticsZip,
  logger,
  readLastExit,
  readRecentEvents,
} from '../diagnostics';
import { formatExitReason } from '../diagnostics/classifyExit';
import type { DiagnosticEvent, ProcessExitRecord } from '../diagnostics';

const FORUM_URL = 'https://forum.opendataensemble.org';
const EMAIL_URL = 'mailto:hello@opendataensemble.org';
const GH_URL = 'https://github.com/OpenDataEnsemble';
const DIAGNOSTIC_EVENT_PREVIEW_LIMIT = 50;

const HelpScreen: React.FC = () => {
  const { t } = useTranslation();
  const [exportingAttachments, setExportingAttachments] = useState(false);
  const [exportingObservations, setExportingObservations] = useState(false);
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [lastExit, setLastExit] = useState<ProcessExitRecord | null>(null);
  const { showConfirm } = useConfirmModal();
  const { themeColors, resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();
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
        e instanceof Error ? e.message : t('help.exportAttachmentsFailed');
      Alert.alert(t('help.exportFailed'), message);
    } finally {
      setExportingAttachments(false);
    }
  };

  const refreshDiagnostics = useCallback(async () => {
    const [recent, exit] = await Promise.all([
      readRecentEvents(DIAGNOSTIC_EVENT_PREVIEW_LIMIT),
      readLastExit(),
    ]);
    setEvents(recent);
    setLastExit(exit);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void logger.breadcrumb('screen', 'help', { screen: 'Help' });
      void refreshDiagnostics();
    }, [refreshDiagnostics]),
  );

  const onExportDiagnostics = async () => {
    setExportingDiagnostics(true);
    try {
      await exportDiagnosticsZip();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t('help.diagnostics.exportFailed');
      Alert.alert(t('help.exportFailed'), message);
    } finally {
      setExportingDiagnostics(false);
    }
  };

  const onClearDiagnostics = () => {
    showConfirm({
      title: t('help.diagnostics.clearTitle'),
      message: t('help.diagnostics.clearMessage'),
      buttons: [
        { text: t('help.diagnostics.ok'), onPress: () => undefined },
        {
          text: t('help.diagnostics.clear'),
          variant: 'danger',
          onPress: () => {
            void clearDiagnosticFiles().then(() => refreshDiagnostics());
          },
        },
      ],
    });
  };

  const onExportObservations = async () => {
    setExportingObservations(true);
    try {
      await observationExportService.exportAllObservationsZip();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : t('help.exportObservationsFailed');
      Alert.alert(t('help.exportFailed'), message);
    } finally {
      setExportingObservations(false);
    }
  };

  return (
    <View style={shellStyle}>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.neutral.transparent },
        ]}
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

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Export device-local data
            </Text>
            <Text
              style={[
                styles.cardText,
                styles.cardTextCentered,
                mutedOnSurface,
              ]}>
              Export on-device attachment files (same paths and filenames as in
              app storage, including unique ids) into a zip, then choose where
              to save it (e.g. Downloads). Does not change any data in the app.
            </Text>
            <Pressable
              onPress={onExportAttachments}
              disabled={exportingAttachments}
              accessibilityRole="button"
              accessibilityLabel="Save device-local attachment data as zip file"
              accessibilityState={{ disabled: exportingAttachments }}
              style={({ pressed }) => [
                styles.exportButton,
                {
                  opacity: exportingAttachments ? 0.55 : pressed ? 0.85 : 1,
                  backgroundColor: themeColors.surface as string,
                  borderColor: themeColors.divider as string,
                },
              ]}>
              {exportingAttachments ? (
                <ActivityIndicator
                  size="small"
                  color={themeColors.onSurface as string}
                />
              ) : (
                <Text
                  style={[
                    styles.exportButtonText,
                    { color: themeColors.onSurface as string },
                  ]}>
                  Download device-local attachment data
                </Text>
              )}
            </Pressable>
            <Text
              style={[
                styles.cardText,
                styles.cardTextCentered,
                mutedOnSurface,
                { marginTop: odeSpacing.sm },
              ]}>
              Export all locally stored observations as one JSON file per row
              (including soft-deleted, but not drafts), packaged in a zip.
              Choose where to save it. Does not change any data in the app.
            </Text>
            <Pressable
              onPress={onExportObservations}
              disabled={exportingObservations}
              accessibilityRole="button"
              accessibilityLabel="Save all observations as zip of JSON files"
              accessibilityState={{ disabled: exportingObservations }}
              style={({ pressed }) => [
                styles.exportButton,
                {
                  opacity: exportingObservations ? 0.55 : pressed ? 0.85 : 1,
                  backgroundColor: themeColors.surface as string,
                  borderColor: themeColors.divider as string,
                },
              ]}>
              {exportingObservations ? (
                <ActivityIndicator
                  size="small"
                  color={themeColors.onSurface as string}
                />
              ) : (
                <Text
                  style={[
                    styles.exportButtonText,
                    { color: themeColors.onSurface as string },
                  ]}>
                  Download observations (JSON zip)
                </Text>
              )}
            </Pressable>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              {t('help.diagnostics.title')}
            </Text>
            <Text
              style={[
                styles.cardText,
                styles.cardTextCentered,
                mutedOnSurface,
              ]}>
              {t('help.diagnostics.hint')}
            </Text>
            <Text
              style={[
                styles.cardText,
                mutedOnSurface,
                { marginTop: odeSpacing.sm },
              ]}>
              {lastExit
                ? t('help.diagnostics.lastExit', {
                    reason: formatExitReason(lastExit),
                    when: new Date(lastExit.timestamp).toLocaleString(),
                  })
                : t('help.diagnostics.noExit')}
            </Text>
            <Pressable
              onPress={onExportDiagnostics}
              disabled={exportingDiagnostics}
              accessibilityRole="button"
              accessibilityLabel={t('help.diagnostics.download')}
              accessibilityState={{ disabled: exportingDiagnostics }}
              style={({ pressed }) => [
                styles.exportButton,
                {
                  marginTop: odeSpacing.sm,
                  opacity: exportingDiagnostics ? 0.55 : pressed ? 0.85 : 1,
                  backgroundColor: themeColors.surface as string,
                  borderColor: themeColors.divider as string,
                },
              ]}>
              {exportingDiagnostics ? (
                <ActivityIndicator
                  size="small"
                  color={themeColors.onSurface as string}
                />
              ) : (
                <Text
                  style={[
                    styles.exportButtonText,
                    { color: themeColors.onSurface as string },
                  ]}>
                  {t('help.diagnostics.download')}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onClearDiagnostics}
              accessibilityRole="button"
              accessibilityLabel={t('help.diagnostics.clear')}
              style={({ pressed }) => [
                styles.exportButton,
                {
                  marginTop: odeSpacing.sm,
                  opacity: pressed ? 0.85 : 1,
                  backgroundColor: themeColors.surface as string,
                  borderColor: themeColors.divider as string,
                },
              ]}>
              <Text
                style={[
                  styles.exportButtonText,
                  { color: themeColors.onSurface as string },
                ]}>
                {t('help.diagnostics.clear')}
              </Text>
            </Pressable>
            <Text style={[styles.eventLog, onSurface]} selectable>
              {events.length === 0
                ? t('help.diagnostics.emptyEvents')
                : events
                    .map(
                      event =>
                        `${event.ts} ${event.level ?? event.kind} ${event.tag ?? ''} ${event.message}`,
                    )
                    .join('\n')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollTransparent: { backgroundColor: colors.neutral.transparent },
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
    backgroundColor: colors.neutral.transparent,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: colors.neutral.transparent,
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
  eventLog: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    marginTop: odeSpacing.sm,
  },
});

export default HelpScreen;
