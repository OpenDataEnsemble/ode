import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { getUserInfo, UserInfo, UserRole } from '../api/synkronus/Auth';
import colors, { withAlpha, CONTAINER_ALPHA } from '../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';
import { useAppTheme, ThemeMode } from '../contexts/AppThemeContext';
import Button from './common/Button';

interface MenuItem {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  screen: string;
  minRole?: UserRole; // Minimum role required to see this item
}

interface MenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  allowClose?: boolean;
}

const ROLE_LEVELS: Record<UserRole, number> = {
  'read-only': 1,
  'read-write': 2,
  admin: 3,
};

const hasMinRole = (
  userRole: UserRole | undefined,
  minRole: UserRole,
): boolean => {
  if (!userRole) return false;
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minRole];
};

const DIVIDER_HEIGHT = 1;

/** Same fade as the bottom nav top line: line color with opacity 0 at ends, 1 in the middle. */
const MenuDivider = ({ color }: { color: string }) => {
  const gradientId = React.useId().replace(/:/g, '');
  return (
    <View style={styles.menuDividerWrap}>
      <Svg
        height={DIVIDER_HEIGHT}
        width="100%"
        style={styles.menuDividerSvg}
        preserveAspectRatio="none">
        <Defs>
          <LinearGradient
            id={gradientId}
            x1="0%"
            y1="0"
            x2="100%"
            y2="0"
            gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.15" stopColor={color} stopOpacity="1" />
            <Stop offset="0.85" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width="100%"
          height={DIVIDER_HEIGHT}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </View>
  );
};

const MenuDrawer: React.FC<MenuDrawerProps> = ({
  visible,
  onClose,
  onNavigate,
  onLogout,
  allowClose = true,
}) => {
  const { themeColors, themeMode, setThemeMode, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const textColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);
  const odeOpacity = (tokens as { opacity?: Record<string, string> }).opacity;
  const dividerOpacityDark =
    odeOpacity?.['10'] != null ? Number(odeOpacity['10']) : 0.1;
  const themeChipBorderOpacityDark =
    odeOpacity?.['50'] != null ? Number(odeOpacity['50']) : 0.5;
  const sectionDividerColor = isDark
    ? withAlpha(colors.neutral.white as string, dividerOpacityDark)
    : (themeColors.divider as string);
  const menuModalBorderColor = sectionDividerColor;
  const themeChipBorderColorDark = isDark
    ? withAlpha(colors.neutral.white as string, themeChipBorderOpacityDark)
    : undefined;
  const cardOuterBg = isDark
    ? withAlpha(themeColors.surface as string, CONTAINER_ALPHA)
    : withAlpha(colors.neutral[900] as string, 0.04);
  const cardInnerBg = isDark
    ? withAlpha(themeColors.surface as string, CONTAINER_ALPHA)
    : withAlpha(colors.neutral[900] as string, 0.02);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  /** Top-level Settings (Server Settings + App Settings). */
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  /** Nested App Settings (themes only). */
  const [appSettingsOpen, setAppSettingsOpen] = useState<boolean>(false);

  // Collapse nested App Settings when main Settings closes
  useEffect(() => {
    if (!settingsOpen) {
      setAppSettingsOpen(false);
    }
  }, [settingsOpen]);
  // Backdrop covers the full height; bottom nav is rendered above this layer
  // by the tab navigator, so its buttons remain clickable.
  const bottomPadding = 0;

  useEffect(() => {
    if (visible) {
      getUserInfo().then(setUserInfo);
    }
  }, [visible]);

  const menuItems: MenuItem[] = [
    {
      icon: 'information',
      label: 'About',
      screen: 'About',
    },
    {
      icon: 'help-circle',
      label: 'Help & Support',
      screen: 'Help',
    },
  ];

  const visibleItems = menuItems.filter(item => {
    if (!item.minRole) return true;
    return hasMinRole(userInfo?.role, item.minRole);
  });

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return styles.roleBadgeAdmin;
      case 'read-write':
        return styles.roleBadgeReadWrite;
      default:
        return styles.roleBadgeReadOnly;
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {allowClose && (
        <TouchableOpacity
          style={[
            styles.backdrop,
            {
              // Fully transparent backdrop: no visual dimming, but still closes on tap
              backgroundColor: 'transparent',
              marginBottom: bottomPadding,
            },
          ]}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
      <View
        style={[
          styles.drawer,
          {
            top: odeSpacing.sm,
            bottom: odeSpacing.sm,
            backgroundColor: isDark
              ? withAlpha(themeColors.surface as string, CONTAINER_ALPHA)
              : (colors.neutral[50] as string),
            shadowColor: themeColors.surface,
            borderLeftWidth: odeBorderWidth.hairline,
            borderLeftColor: isDark
              ? menuModalBorderColor
              : withAlpha(colors.neutral.black as string, 0.18),
            borderTopWidth: odeBorderWidth.hairline,
            borderBottomWidth: odeBorderWidth.hairline,
            borderTopColor: menuModalBorderColor,
            borderBottomColor: menuModalBorderColor,
          },
        ]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Menu</Text>
            {allowClose && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={themeColors.onSurface} />
              </TouchableOpacity>
            )}
          </View>
          <MenuDivider color={menuModalBorderColor} />

          {/* User Info Section */}
          {userInfo ? (
            <>
              <View
                style={[styles.userSection, { backgroundColor: cardOuterBg }]}>
                <View
                  style={[
                    styles.userAvatar,
                    { backgroundColor: themeColors.primary },
                  ]}>
                  <Icon
                    name="account"
                    size={32}
                    color={themeColors.onPrimary}
                  />
                </View>
                <View style={styles.userInfo}>
                  <View
                    style={[
                      styles.roleBadge,
                      getRoleBadgeStyle(userInfo.role),
                      userInfo.role === 'admin' && {
                        backgroundColor: themeColors.primary as string,
                      },
                    ]}>
                    <Text style={styles.roleBadgeText}>
                      {userInfo.role === 'admin'
                        ? 'Admin'
                        : userInfo.role === 'read-write'
                          ? 'Read-write'
                          : 'Read-only'}
                    </Text>
                  </View>
                </View>
              </View>
              <MenuDivider color={menuModalBorderColor} />
            </>
          ) : (
            <>
              <View
                style={[styles.userSection, { backgroundColor: cardOuterBg }]}>
                <View
                  style={[
                    styles.userAvatar,
                    styles.userAvatarInactive,
                    isDark && styles.userAvatarInactiveDark,
                  ]}>
                  <Icon
                    name="account-off"
                    size={32}
                    color={
                      isDark
                        ? (colors.neutral[400] as string)
                        : themeColors.onSurface
                    }
                  />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userNameInactive, { color: textColor }]}>
                    Not logged in
                  </Text>
                  <Text style={[styles.loginHint, { color: textColor }]}>
                    Click the Login at the bottom
                  </Text>
                </View>
              </View>
              <MenuDivider color={menuModalBorderColor} />
            </>
          )}

          <ScrollView style={styles.menuList}>
            {/* Settings: Server Settings (login/server URL) + App Settings (themes) */}
            <View style={styles.menuItem}>
              <View style={styles.themeContent}>
                <TouchableOpacity
                  style={styles.appSettingsHeader}
                  activeOpacity={0.8}
                  onPress={() => setSettingsOpen(open => !open)}>
                  <View style={styles.appSettingsTitleRow}>
                    <Icon name="cog" size={24} color={textColor} />
                    <Text
                      style={[
                        styles.menuLabel,
                        styles.appSettingsLabel,
                        { color: textColor },
                      ]}>
                      Settings
                    </Text>
                    <Icon
                      name={settingsOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={textColor}
                      style={styles.appSettingsChevron}
                    />
                  </View>
                </TouchableOpacity>
                {settingsOpen && (
                  <View style={styles.settingsNestedBlock}>
                    {/* Server Settings: same destination as bottom Login */}
                    <TouchableOpacity
                      style={styles.serverSettingsRow}
                      activeOpacity={0.8}
                      onPress={() => {
                        onClose();
                        onNavigate('Settings');
                      }}>
                      <Icon name="server-network" size={22} color={textColor} />
                      <Text
                        style={[
                          styles.menuLabel,
                          styles.nestedSettingsLabel,
                          { color: textColor },
                        ]}>
                        Server Settings
                      </Text>
                      <Icon
                        name="chevron-right"
                        size={20}
                        color={textColor}
                        style={styles.nestedChevronRight}
                      />
                    </TouchableOpacity>
                    <MenuDivider color={menuModalBorderColor} />
                    {/* App Settings: nested dropdown for themes only */}
                    <TouchableOpacity
                      style={styles.appSettingsSubHeader}
                      activeOpacity={0.8}
                      onPress={() => setAppSettingsOpen(open => !open)}>
                      <View style={styles.appSettingsTitleRow}>
                        <Icon name="palette" size={22} color={textColor} />
                        <Text
                          style={[
                            styles.menuLabel,
                            styles.nestedSettingsLabel,
                            { color: textColor },
                          ]}>
                          App Settings
                        </Text>
                        <Icon
                          name={appSettingsOpen ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={textColor}
                          style={styles.appSettingsChevron}
                        />
                      </View>
                    </TouchableOpacity>
                    {appSettingsOpen && (
                      <View
                        style={[
                          styles.themesCardOuter,
                          {
                            borderColor: menuModalBorderColor,
                            backgroundColor: cardOuterBg,
                          },
                        ]}>
                        <View
                          style={[
                            styles.themesCardInner,
                            { backgroundColor: cardInnerBg },
                          ]}>
                          <Text
                            style={[styles.themesTitle, { color: textColor }]}>
                            Themes
                          </Text>
                          <View style={styles.themeOptionsColumn}>
                            {(['system', 'dark', 'light'] as ThemeMode[]).map(
                              mode => (
                                <TouchableOpacity
                                  key={mode}
                                  style={[
                                    styles.themeChip,
                                    {
                                      borderColor:
                                        themeMode === mode
                                          ? (themeColors.primary as string)
                                          : isDark
                                            ? (themeChipBorderColorDark as string)
                                            : (colors.neutral[400] as string),
                                    },
                                  ]}
                                  activeOpacity={0.8}
                                  onPress={() => setThemeMode(mode)}>
                                  <Text
                                    style={[
                                      styles.themeChipLabel,
                                      {
                                        color:
                                          themeMode === mode
                                            ? (themeColors.primary as string)
                                            : isDark
                                              ? (colors.neutral[200] as string)
                                              : (colors.neutral[700] as string),
                                      },
                                    ]}>
                                    {mode === 'system'
                                      ? 'System'
                                      : mode === 'dark'
                                        ? 'Dark'
                                        : 'Light'}
                                  </Text>
                                </TouchableOpacity>
                              ),
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
            <MenuDivider color={menuModalBorderColor} />

            {visibleItems.map((item, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => onNavigate(item.screen)}>
                  <Icon name={item.icon} size={24} color={textColor} />
                  <Text style={[styles.menuLabel, { color: textColor }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
                <MenuDivider color={menuModalBorderColor} />
              </React.Fragment>
            ))}
          </ScrollView>

          <MenuDivider color={menuModalBorderColor} />
          <View style={[styles.footer, { backgroundColor: cardOuterBg }]}>
            {userInfo ? (
              <Button
                title="Logout"
                onPress={onLogout}
                variant="danger"
                size="medium"
                fullWidth
              />
            ) : (
              <Button
                title="Login"
                onPress={() => {
                  onClose();
                  onNavigate('Settings');
                }}
                variant="primary"
                size="medium"
                fullWidth
              />
            )}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '80%',
    maxWidth: 320,
    borderTopLeftRadius: odeRadius.card,
    borderBottomLeftRadius: odeRadius.card,
    overflow: 'hidden',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: odeSpacing.md,
  },
  menuDividerWrap: {
    alignSelf: 'stretch',
    height: DIVIDER_HEIGHT,
    overflow: 'hidden',
  },
  menuDividerSvg: {
    height: DIVIDER_HEIGHT,
  },
  headerTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '700',
  },
  closeButton: {
    padding: odeSpacing.xxs,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: odeSpacing.md,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarInactive: {
    backgroundColor: colors.ui.gray.medium,
  },
  userAvatarInactiveDark: {
    backgroundColor: colors.neutral[600] as string,
  },
  userInfo: {
    marginLeft: odeSpacing.sm,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    marginBottom: odeSpacing.xs,
  },
  userNameInactive: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    marginBottom: odeSpacing.xs,
  },
  loginHint: {
    fontSize: odeTypography.caption,
  },
  roleBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: odeSpacing.xs,
    paddingVertical: odeSpacing.xxs,
    borderRadius: odeRadius.inner,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.semantic.error.ios,
  },
  roleBadgeReadWrite: {
    backgroundColor: colors.semantic.info.ios,
  },
  roleBadgeReadOnly: {
    backgroundColor: colors.ui.gray.ios,
  },
  roleBadgeText: {
    color: colors.neutral.white,
    fontSize: odeTypography.caption,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: odeSpacing.md,
  },
  menuLabel: {
    flex: 1,
    marginLeft: odeSpacing.sm,
    fontSize: odeTypography.body,
  },
  themeContent: {
    flex: 1,
    marginLeft: 0,
  },
  appSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appSettingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
  },
  appSettingsLabel: {
    marginLeft: 0,
  },
  appSettingsChevron: {
    marginLeft: odeSpacing.xs,
  },
  settingsNestedBlock: {
    marginTop: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    overflow: 'hidden',
  },
  serverSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    paddingVertical: odeSpacing.sm,
    paddingHorizontal: odeSpacing.xs,
  },
  appSettingsSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: odeSpacing.sm,
    paddingHorizontal: odeSpacing.xs,
    marginTop: odeSpacing.xs,
  },
  nestedSettingsLabel: {
    flex: 1,
    marginLeft: 0,
  },
  nestedChevronRight: {
    marginLeft: 'auto',
  },
  sectionLabel: {
    marginTop: odeSpacing.sm,
    fontSize: odeTypography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  themeOptionsColumn: {
    flexDirection: 'column',
    marginTop: odeSpacing.xs,
    gap: odeSpacing.sm,
    alignItems: 'center',
  },
  themeChip: {
    paddingHorizontal: odeSpacing.lg,
    paddingVertical: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
    backgroundColor: 'transparent',
    minWidth: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeChipLabel: {
    fontSize: odeTypography.caption,
    fontWeight: '600',
  },
  footer: {
    padding: odeSpacing.md,
    borderBottomLeftRadius: odeRadius.card,
  },
  themesCardOuter: {
    borderRadius: odeRadius.card,
    marginTop: odeSpacing.sm,
    borderWidth: odeBorderWidth.hairline,
  },
  themesCardInner: {
    borderRadius: odeRadius.inner,
    overflow: 'hidden',
    padding: odeSpacing.md,
  },
  themesTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: odeSpacing.sm,
  },
});

export default MenuDrawer;
