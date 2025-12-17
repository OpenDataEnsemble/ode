import React, {useState, useEffect} from 'react';
import {StyleSheet, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useRoute,
  useNavigation,
  CompositeNavigationProp,
} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {StackNavigationProp} from '@react-navigation/stack';
import {
  MainTabParamList,
  MainAppStackParamList,
} from '../types/NavigationTypes';
import MenuDrawer from '../components/MenuDrawer';
import {logout} from '../api/synkronus/Auth';

type MoreScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'More'>,
  StackNavigationProp<MainAppStackParamList>
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
    const params = route.params as {openDrawer?: number} | undefined;
    if (params?.openDrawer) {
      setDrawerVisible(true);
    }
  }, [route.params]);

  const handleNavigate = (screen: string) => {
    setDrawerVisible(false);
    // Navigate to screens in the MainAppStack
    if (screen === 'Settings' || screen === 'FormManagement') {
      navigation.navigate(screen as keyof MainAppStackParamList);
    } else {
      // Other screens not yet implemented - stay on Home for now
      console.log('Navigate to:', screen, '(not yet implemented)');
      navigation.navigate('Home');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
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
    backgroundColor: '#FFFFFF',
  },
});

export default MoreScreen;
