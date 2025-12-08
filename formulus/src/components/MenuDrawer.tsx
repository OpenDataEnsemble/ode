import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
  adminOnly?: boolean;
}

interface MenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  allowClose?: boolean;
}

const MenuDrawer: React.FC<MenuDrawerProps> = ({
  visible,
  onClose,
  onNavigate,
  onLogout,
  allowClose = true,
}) => {
  const menuItems: MenuItem[] = [
    {
      icon: 'clipboard-list',
      label: 'Form Management',
      onPress: () => onNavigate('FormManagement'),
      adminOnly: true,
    },
    {
      icon: 'cog',
      label: 'App Settings',
      onPress: () => onNavigate('Settings'),
    },
    {
      icon: 'account',
      label: 'User Profile',
      onPress: () => onNavigate('Profile'),
    },
    {
      icon: 'information',
      label: 'About',
      onPress: () => onNavigate('About'),
    },
    {
      icon: 'help-circle',
      label: 'Help & Support',
      onPress: () => onNavigate('Help'),
    },
    {
      icon: 'lock',
      label: 'Privacy Policy',
      onPress: () => onNavigate('PrivacyPolicy'),
    },
  ];

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
        <View style={styles.drawer}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Menu</Text>
              {allowClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color="#000000" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.menuList}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    item.onPress();
                  }}>
                  <Icon name={item.icon} size={24} color="#333333" />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => {
                  onLogout();
                }}>
                <Icon name="logout" size={24} color="#FF3B30" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
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
    bottom: 0,
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
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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

