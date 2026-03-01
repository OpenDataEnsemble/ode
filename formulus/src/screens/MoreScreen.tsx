import React, { useState, useEffect } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, VisibleMainTab } from '../types/NavigationTypes';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import MenuDrawer from '../components/MenuDrawer';
import { logout } from '../api/synkronus/Auth';

type MoreScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'More'
>;

const MoreScreen: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const route = useRoute();
  const navigation = useNavigation<MoreScreenNavigationProp>();

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
    if (screen === 'Settings') {
      navigation.navigate('Settings');
    } else if (screen === 'About') {
      navigation.navigate('About');
    } else if (screen === 'Help') {
      navigation.navigate('Help');
    } else {
      navigation.navigate('Home');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          setDrawerVisible(false);
          navigation.navigate('Home');
        },
      },
    ]);
  };

  const handleClose = () => {
    setDrawerVisible(false);
    navigation.navigate('Home');
  };

  return (
    <BlurredScreenBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <MenuDrawer
          visible={drawerVisible}
          onClose={handleClose}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          allowClose={true}
        />
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default MoreScreen;
