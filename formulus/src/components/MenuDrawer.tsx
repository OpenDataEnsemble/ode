import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {getUserInfo, UserInfo, UserRole} from '../api/synkronus/Auth';

interface MenuItem {
  icon: string;
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
      icon: 'clipboard-list',
      label: 'Form Management',
      screen: 'FormManagement',
      minRole: 'admin',
    },
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
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
        )}
        <View style={[styles.drawer, {bottom: bottomPadding}]}>
          <SafeAreaView
            style={styles.safeArea}
            edges={['top', 'left', 'right']}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Menu</Text>
              {allowClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color="#000000" />
                </TouchableOpacity>
              )}
            </View>

            {/* User Info Section */}
            {userInfo ? (
              <View style={styles.userSection}>
                <View style={styles.userAvatar}>
                  <Icon name="account" size={32} color="#fff" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{userInfo.username}</Text>
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
              <View style={styles.userSection}>
                <View style={[styles.userAvatar, styles.userAvatarInactive]}>
                  <Icon name="account-off" size={32} color="#999" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userNameInactive}>Not logged in</Text>
                  <Text style={styles.loginHint}>Go to Settings to login</Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.menuList}>
              {visibleItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => onNavigate(item.screen)}>
                  <Icon name={item.icon} size={24} color="#333333" />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {userInfo && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={onLogout}>
                  <Icon name="logout" size={24} color="#FF3B30" />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: -2, height: 0},
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
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarInactive: {
    backgroundColor: '#ddd',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userNameInactive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  loginHint: {
    fontSize: 12,
    color: '#666',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeAdmin: {
    backgroundColor: '#FF3B30',
  },
  roleBadgeReadWrite: {
    backgroundColor: '#007AFF',
  },
  roleBadgeReadOnly: {
    backgroundColor: '#8E8E93',
  },
  roleBadgeText: {
    color: '#fff',
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
    borderBottomColor: '#F5F5F5',
  },
  menuLabel: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#333333',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    padding: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  logoutText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
});

export default MenuDrawer;
