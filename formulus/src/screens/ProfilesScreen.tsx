import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';

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
import { setCredentialsForProfile } from '../profiles/ProfileKeychain';
import type { SettingsUpdate } from '../services/QRSettingsService';
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

type LabelEditor = {
  id?: string;
  label: string;
  initialSettings?: SettingsUpdate;
};

const ProfilesScreen = () => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const { showConfirm } = useConfirmModal();

  const { profiles, activeProfile } = useProfiles();
  const [editor, setEditor] = useState<LabelEditor | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    setDropdownOpen(false);
    if (busyRef.current || id === activeProfile.id) return;
    const selected = profiles.find(profile => profile.id === id);
    if (!selected) return;
    showConfirm({
      title: t('profiles.switchTitle'),
      message: t('profiles.switchMessage', { label: selected.label }),
      buttons: [
        { text: t('common.cancel'), variant: 'tertiary', onPress: () => {} },
        {
          text: t('common.ok'),
          variant: 'primary',
          onPress: () => {
            void runAction(async () => {
              await transitionToProfiles(() => switchProfile(id), id);
            }, 'profiles.switchFailed');
          },
        },
      ],
    });
  };

  const saveLabel = () => {
    if (!editor?.id || !editor.label.trim()) return;
    const { id, label } = editor;
    void runAction(async () => {
      await profileRegistry.rename(id, label.trim());
      if (mountedRef.current) setEditor(null);
    }, 'profiles.renameFailed');
  };

  const createProfile = async (connection: {
    serverUrl: string;
    username: string;
    password: string;
  }) => {
    if (!editor || editor.id || !editor.label.trim()) return;
    const created = await profileRegistry.add(editor.label.trim(), {
      serverUrl: connection.serverUrl,
      username: connection.username,
    });
    if (mountedRef.current) setEditor(null);
    if (connection.username && connection.password) {
      try {
        const saved = await setCredentialsForProfile(
          created.id,
          connection.username,
          connection.password,
        );
        if (saved === false) throw new Error('Credential save failed');
      } catch {
        throw new ProfileUIError('profiles.qrCredentialsFailed');
      }
    }
    try {
      await transitionToProfiles(() => switchProfile(created.id), created.id);
    } catch {
      throw new ProfileUIError('profiles.addSwitchFailed');
    }
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
          <View style={styles.selectorRow}>
            <TouchableOpacity
              style={[styles.dropdown, { borderColor: themeColors.divider }]}
              accessibilityRole="button"
              accessibilityLabel={t('profiles.choose')}
              accessibilityState={{ expanded: dropdownOpen, disabled: busy }}
              disabled={busy}
              onPress={() => setDropdownOpen(open => !open)}>
              <View style={styles.dropdownLabel}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.profileLabel,
                    { color: themeColors.onSurface },
                  ]}>
                  {activeProfile.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.description,
                    { color: themeColors.onSurface },
                  ]}>
                  {activeProfile.serverUrl || t('profiles.notConfigured')}
                </Text>
              </View>
              <Icon
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={themeColors.onSurface}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: themeColors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profiles.add')}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                setDropdownOpen(false);
                setEditor({ label: '' });
              }}>
              <Icon name="plus" size={26} color={themeColors.onPrimary} />
            </TouchableOpacity>
          </View>
          {dropdownOpen && (
            <View
              style={[styles.options, { borderColor: themeColors.divider }]}>
              {profiles.map(profile => {
                const active = profile.id === activeProfile.id;
                return (
                  <View key={profile.id} style={styles.optionGroup}>
                    <TouchableOpacity
                      style={styles.option}
                      accessibilityRole="radio"
                      accessibilityLabel={t('profiles.selectLabel', {
                        label: profile.label,
                      })}
                      accessibilityState={{ checked: active, disabled: busy }}
                      disabled={busy}
                      onPress={() => selectProfile(profile.id)}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.profileLabel,
                          { color: themeColors.onSurface },
                        ]}>
                        {profile.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.description,
                          { color: themeColors.onSurface },
                        ]}>
                        {profile.serverUrl || t('profiles.notConfigured')}
                      </Text>
                      {active && (
                        <Icon
                          name="check"
                          size={20}
                          color={themeColors.primary}
                        />
                      )}
                    </TouchableOpacity>
                    {!active && (
                      <View style={styles.optionActions}>
                        <Button
                          title={t('profiles.rename')}
                          accessibilityLabel={t('profiles.renameLabel', {
                            label: profile.label,
                          })}
                          variant="tertiary"
                          size="small"
                          disabled={busy}
                          onPress={() => {
                            setDropdownOpen(false);
                            setEditor({ id: profile.id, label: profile.label });
                          }}
                        />
                        <Button
                          title={t('common.delete')}
                          accessibilityLabel={t('profiles.deleteLabel', {
                            label: profile.label,
                          })}
                          variant="danger"
                          size="small"
                          disabled={busy || profiles.length <= 1}
                          onPress={() => {
                            setDropdownOpen(false);
                            confirmDelete(profile.id, profile.label);
                          }}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.actions}>
            <Button
              title={t('profiles.rename')}
              accessibilityLabel={t('profiles.renameLabel', {
                label: activeProfile.label,
              })}
              variant="tertiary"
              size="small"
              disabled={busy}
              onPress={() =>
                setEditor({ id: activeProfile.id, label: activeProfile.label })
              }
            />
            <Button
              title={t('common.delete')}
              accessibilityLabel={t('profiles.deleteLabel', {
                label: activeProfile.label,
              })}
              variant="danger"
              size="small"
              disabled={busy || profiles.length <= 1}
              onPress={() =>
                confirmDelete(activeProfile.id, activeProfile.label)
              }
            />
          </View>
          {profiles.length === 1 && (
            <Text
              style={[styles.description, { color: themeColors.onSurface }]}>
              {t('profiles.lastProfileHint')}
            </Text>
          )}
          {editor && (
            <View style={[styles.editor, { borderColor: themeColors.divider }]}>
              <Text
                style={[styles.profileLabel, { color: themeColors.onSurface }]}>
                {t(editor.id ? 'profiles.rename' : 'profiles.add')}
              </Text>
              <Input
                label={t('profiles.name')}
                placeholder={t('profiles.name')}
                required={!editor.id}
                value={editor.label}
                onChangeText={label => setEditor({ ...editor, label })}
                disabled={busy}
                autoCorrect={false}
              />
              {!editor.id && (
                <ProfileConnection
                  key={`new-${activeProfile.id}`}
                  profile={activeProfile}
                  busy={busy}
                  runAction={runAction}
                  creation={{
                    name: editor.label,
                    initialSettings: editor.initialSettings,
                    onCreate: createProfile,
                  }}
                />
              )}
              <View style={styles.actions}>
                <Button
                  title={t('common.cancel')}
                  variant="tertiary"
                  disabled={busy}
                  onPress={() => setEditor(null)}
                />
                {!!editor.id && (
                  <Button
                    title={t('profiles.saveName')}
                    disabled={busy || !editor.label.trim()}
                    onPress={saveLabel}
                  />
                )}
              </View>
            </View>
          )}
          {(!editor || !!editor.id) && (
            <ProfileConnection
              key={activeProfile.id}
              profile={activeProfile}
              busy={busy}
              runAction={runAction}
              onNewProfileFromQR={settings =>
                setEditor({ label: '', initialSettings: settings })
              }
            />
          )}
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
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
  },
  dropdown: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: odeBorderWidth.hairline,
    borderRadius: odeSpacing.sm,
    padding: odeSpacing.sm,
  },
  dropdownLabel: { flex: 1 },
  options: {
    borderWidth: odeBorderWidth.hairline,
    borderRadius: odeSpacing.sm,
    overflow: 'hidden',
  },
  optionGroup: { padding: odeSpacing.xs },
  option: { minHeight: 52, padding: odeSpacing.sm },
  optionActions: { flexDirection: 'row', gap: odeSpacing.sm },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileLabel: { fontSize: odeTypography.body, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: odeSpacing.sm },
  editor: {
    borderWidth: odeBorderWidth.hairline,
    borderRadius: odeSpacing.sm,
    padding: odeSpacing.md,
    gap: odeSpacing.sm,
  },
});

export default ProfilesScreen;
