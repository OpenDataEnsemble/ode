import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, VisibleMainTab } from '../types/NavigationTypes';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import MenuDrawer from '../components/MenuDrawer';
import { logout } from '../api/synkronus/Auth';
import { useConfirmModal } from '../contexts/ConfirmModalContext';

type MoreScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'More'
>;

const MoreScreen: React.FC = () => {
  const shellStyle = useScreenShellStyle();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const route = useRoute();
  const navigation = useNavigation<MoreScreenNavigationProp>();
  const { showConfirm } = useConfirmModal();

  useFocusEffect(
    React.useCallback(() => {
      setDrawerVisible(true);
    }, []),
  );

  useEffect(() => {
    const params = route.params as
      | { toggleDrawer?: number; originTab?: VisibleMainTab }
      | undefined;
    if (params?.toggleDrawer) {
      Promise.resolve().then(() => {
        setDrawerVisible(prev => {
          if (prev) {
            // Closing via 3 dots: go back to where we came from (or Home).
            const target =
              params.originTab && params.originTab !== 'More'
                ? params.originTab
                : 'Home';
            navigation.navigate(target as keyof MainTabParamList);
            return false;
          }
          return true;
        });
      });
    }
  }, [route.params, navigation]);

  const handleNavigate = (screen: string) => {
    setDrawerVisible(false);
    const target =
      screen === 'Settings' || screen === 'About' || screen === 'Help'
        ? screen
        : 'Home';
    navigation.navigate(target as keyof MainTabParamList);
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', onPress: () => {}, variant: 'tertiary' },
        {
          text: 'Logout',
          variant: 'danger',
          onPress: async () => {
            await logout();
            setDrawerVisible(false);
            navigation.navigate('Home');
          },
        },
      ],
    });
  };

  const handleClose = () => {
    setDrawerVisible(false);
    navigation.navigate('Home');
  };

  return (
    <View style={shellStyle}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <MenuDrawer
          visible={drawerVisible}
          onClose={handleClose}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          allowClose={true}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default MoreScreen;
