import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import { Button, Input } from '../components/common';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';

import { useProfiles } from '../navigation/useProfiles';
import { transitionToProfiles } from '../navigation/ProfileNavigationIntent';
import { profileRegistry } from '../profiles/ProfileRegistry';
import { switchProfile, deleteProfile } from '../profiles/ProfileTransitions';
import { ToastService } from '../services/ToastService';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import ProfileConnection from './ProfileConnection';
import { ProfileUIError, profileErrorKey } from './profileUiErrors';

export type RunProfileAction = (
  operation: () => Promise<void>,
  fallbackKey: string,
) => Promise<void>;

type LabelEditor = { id?: string; label: string };

const ProfilesScreen = () => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const { showConfirm } = useConfirmModal();

  const { profiles, activeProfile } = useProfiles();
  const [editor, setEditor] = useState<LabelEditor | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAction = useCallback<RunProfileAction>(
    async (operation, fallbackKey) => {
      if (busyRef.current || !mountedRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await operation();
      } catch (error) {
        // Commit failures are explained by the host's recovery screen. Never
        // report success/failure through the old shell after it was unmounted.
        if (mountedRef.current) {
          ToastService.showLong(t(profileErrorKey(error, fallbackKey)));
        }
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    },
    [t],
  );

  const selectProfile = (id: string) => {
    void runAction(async () => {
      await transitionToProfiles(() => switchProfile(id), id);

    }, 'profiles.switchFailed');
  };

  const saveLabel = () => {
    if (!editor || (editor.id && !editor.label.trim())) return;
    const { id, label } = editor;
    void runAction(
      async () => {
        if (id) {
          await profileRegistry.rename(id, label.trim());
        } else {
          const created = await profileRegistry.add(label.trim() || undefined);
          // Close the editor once creation commits, even if switching is busy.
          if (mountedRef.current) setEditor(null);
          try {
            await transitionToProfiles(() => switchProfile(created.id), created.id);
          } catch {
            throw new ProfileUIError('profiles.addSwitchFailed');
          }
        }
        if (mountedRef.current) setEditor(null);
      },
      id ? 'profiles.renameFailed' : 'profiles.addFailed',
    );
  };

  const confirmDelete = (id: string, label: string) => {
    if (busyRef.current || profiles.length <= 1) return;
    showConfirm({
      title: t('profiles.deleteTitle'),
      message: t('profiles.deleteMessage', { label }),
      buttons: [
        { text: t('common.cancel'), variant: 'tertiary', onPress: () => {} },
        {
          text: t('common.delete'),
          variant: 'danger',
          onPress: () => {
            void runAction(async () => {
              await transitionToProfiles(() => deleteProfile(id));
            }, 'profiles.deleteFailed');
          },
        },
      ],
    });
  };

  return (
    <View style={shellStyle}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.primary,
              borderBottomColor: themeColors.divider,
            },
          ]}>
          <Text style={[styles.title, { color: themeColors.onPrimary }]}>
            {t('profiles.title')}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text style={[styles.description, { color: themeColors.onSurface }]}>
            {t('profiles.description')}
          </Text>
          <Text style={[styles.description, { color: themeColors.onSurface }]}>
            {t('profiles.restartHint')}
          </Text>
          {profiles.map(profile => {
            const active = profile.id === activeProfile.id;
            return (
              <View
                key={profile.id}
                style={[
                  styles.profile,
                  {
                    borderColor: active
                      ? themeColors.primary
                      : themeColors.divider,
                  },
                ]}>
                <TouchableOpacity
                  style={styles.picker}
                  accessibilityRole="radio"
                  accessibilityLabel={t('profiles.selectLabel', {
                    label: profile.label,
                  })}
                  accessibilityState={{
                    checked: active,
                    disabled: busy || active,
                  }}
                  disabled={busy || active}
                  onPress={() => selectProfile(profile.id)}>
                  <Text
                    style={[
                      styles.profileLabel,
                      { color: themeColors.onSurface },
                    ]}>
                    {profile.label}
                  </Text>
                  <Text
                    style={[
                      styles.description,
                      { color: themeColors.onSurface },
                    ]}>
                    {profile.serverUrl || t('profiles.notConfigured')}
                  </Text>
                  {active && (
                    <Text style={{ color: themeColors.primary }}>
                      {t('profiles.active')}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.actions}>
                  <Button
                    title={t('profiles.rename')}
                    accessibilityLabel={t('profiles.renameLabel', {
                      label: profile.label,
                    })}
                    variant="tertiary"
                    size="small"
                    disabled={busy}
                    onPress={() =>
                      setEditor({ id: profile.id, label: profile.label })
                    }
                  />
                  <Button
                    title={t('common.delete')}
                    accessibilityLabel={t('profiles.deleteLabel', {
                      label: profile.label,
                    })}
                    variant="danger"
                    size="small"
                    disabled={busy || profiles.length <= 1}
                    onPress={() => confirmDelete(profile.id, profile.label)}
                  />
                </View>
              </View>
            );
          })}
          {profiles.length === 1 && (
            <Text
              style={[styles.description, { color: themeColors.onSurface }]}>
              {t('profiles.lastProfileHint')}
            </Text>
          )}
          {editor ? (
            <View style={styles.editor}>
              <Input
                placeholder={t('profiles.name')}
                value={editor.label}
                onChangeText={label => setEditor({ ...editor, label })}
                disabled={busy}
                autoCorrect={false}
              />
              <View style={styles.actions}>
                <Button
                  title={t('common.cancel')}
                  variant="tertiary"
                  disabled={busy}
                  onPress={() => setEditor(null)}
                />
                <Button
                  title={t(editor.id ? 'profiles.saveName' : 'profiles.add')}
                  disabled={busy || (!!editor.id && !editor.label.trim())}
                  onPress={saveLabel}
                />
              </View>
            </View>
          ) : (
            <Button
              title={t('profiles.add')}
              variant="secondary"
              disabled={busy}
              onPress={() => setEditor({ label: '' })}
            />
          )}
          <ProfileConnection
            key={activeProfile.id}
            profile={activeProfile}
            busy={busy}
            runAction={runAction}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: odeSpacing.md,
    minHeight: odeScreenHeaderHeight,
    borderBottomWidth: odeBorderWidth.hairline,
    justifyContent: 'center',
  },
  title: { fontSize: odeTypography.screenTitle, fontWeight: 'bold' },
  content: {
    padding: odeSpacing.md,
    paddingBottom: odeSpacing.lg,
    gap: odeSpacing.sm,
  },
  description: { fontSize: odeTypography.bodySm },
  profile: {
    borderWidth: odeBorderWidth.hairline,
    borderRadius: 8,
    padding: odeSpacing.sm,
    gap: odeSpacing.xs,
  },
  picker: { minHeight: 44, gap: odeSpacing.xs },
  profileLabel: { fontSize: odeTypography.body, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: odeSpacing.sm },
  editor: { gap: odeSpacing.xs },
});

export default ProfilesScreen;
