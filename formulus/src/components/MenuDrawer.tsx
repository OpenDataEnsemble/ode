import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { getUserInfo, UserInfo, UserRole } from '../api/synkronus/Auth';
import colors, { withAlpha, CONTAINER_ALPHA } from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
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

const MenuDrawer: React.FC<MenuDrawerProps> = ({
  visible,
  onClose,
  onNavigate,
  onLogout,
  allowClose = true,
}) => {
  const { themeColors } = useAppTheme();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const bottomPadding = TAB_BAR_HEIGHT + insets.bottom;

  useEffect(() => {
    if (visible) {
      getUserInfo().then(setUserInfo);
    }
  }, [visible]);

  const menuItems: MenuItem[] = [
    {
      icon: 'cog',
      label: 'App Settings',
      screen: 'Settings',
    },
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={allowClose ? onClose : undefined}>
      <View style={styles.overlay}>
        {allowClose && (
          <TouchableOpacity
            style={[styles.backdrop, { backgroundColor: colors.ui.background }]}
            activeOpacity={1}
            onPress={onClose}
          />
        )}
        <View
          style={[
            styles.drawer,
            {
              bottom: bottomPadding,
              backgroundColor: withAlpha(themeColors.surface as string, CONTAINER_ALPHA),
              shadowColor: themeColors.surface,
              borderWidth: 1,
              borderColor: themeColors.divider as string,
            },
          ]}>
          <SafeAreaView
            style={styles.safeArea}
            edges={['top', 'left', 'right']}>
            <View
              style={[
                styles.header,
                { borderBottomColor: themeColors.divider },
              ]}>
              <Text
                style={[styles.headerTitle, { color: themeColors.onSurface }]}>
                Menu
              </Text>
              {allowClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon
                    name="close"
                    size={24}
                    color={themeColors.onSurface}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* User Info Section */}
            {userInfo ? (
              <View
                style={[
                  styles.userSection,
                  {
                    backgroundColor: withAlpha(themeColors.background as string, CONTAINER_ALPHA),
                    borderBottomColor: themeColors.divider,
                    borderWidth: 1,
                    borderColor: themeColors.divider as string,
                  },
                ]}>
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
                  <Text
                    style={[styles.userName, { color: themeColors.onSurface }]}>
                    {userInfo.username}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      getRoleBadgeStyle(userInfo.role),
                    ]}>
                    <Text style={styles.roleBadgeText}>{userInfo.role}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.userSection,
                  {
                    backgroundColor: withAlpha(themeColors.background as string, CONTAINER_ALPHA),
                    borderBottomColor: themeColors.divider,
                    borderWidth: 1,
                    borderColor: themeColors.divider as string,
                  },
                ]}>
                <View style={[styles.userAvatar, styles.userAvatarInactive]}>
                  <Icon
                    name="account-off"
                    size={32}
                    color={themeColors.onSurface}
                  />
                </View>
                <View style={styles.userInfo}>
                  <Text
                    style={[
                      styles.userNameInactive,
                      { color: themeColors.onSurface },
                    ]}>
                    Not logged in
                  </Text>
                  <Text
                    style={[
                      styles.loginHint,
                      { color: themeColors.onSurface },
                    ]}>
                    Go to Settings to login
                  </Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.menuList}>
              {visibleItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: themeColors.divider },
                  ]}
                  onPress={() => onNavigate(item.screen)}>
                  <Icon
                    name={item.icon}
                    size={24}
                    color={themeColors.onSurface}
                  />
                  <Text
                    style={[styles.menuLabel, { color: themeColors.onSurface }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {userInfo && (
              <View
                style={[
                  styles.footer,
                  {
                    backgroundColor: withAlpha(themeColors.surface as string, CONTAINER_ALPHA),
                    borderTopColor: themeColors.divider,
                    borderWidth: 1,
                    borderColor: themeColors.divider as string,
                  },
                ]}>
                <Button
                  title="Logout"
                  onPress={onLogout}
                  variant="danger"
                  size="medium"
                  fullWidth
                />
              </View>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
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
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userNameInactive: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  loginHint: {
    fontSize: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuLabel: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
});

export default MenuDrawer;
