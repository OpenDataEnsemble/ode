import React, { useState, useEffect } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/NavigationTypes';
import MenuDrawer from '../components/MenuDrawer';
import { logout } from '../api/synkronus/Auth';
import { colors } from '../theme/colors';

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
    const params = route.params as { openDrawer?: number } | undefined;
    if (params?.openDrawer) {
      Promise.resolve().then(() => {
        setDrawerVisible(true);
      });
    }
  }, [route.params]);

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
    <SafeAreaView style={styles.container}>
      <MenuDrawer
        visible={drawerVisible}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        allowClose={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
});

export default MoreScreen;
