import React, {useState, useEffect} from 'react';
import {StyleSheet, SafeAreaView} from 'react-native';
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {MainTabParamList} from '../types/NavigationTypes';
import MenuDrawer from '../components/MenuDrawer';

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
    const params = route.params as {openDrawer?: number} | undefined;
    if (params?.openDrawer) {
      setDrawerVisible(true);
    }
  }, [route.params]);

  const handleNavigate = (screen: string) => {
    setDrawerVisible(false);
    console.log('Navigate to:', screen);
    navigation.navigate('Home');
  };

  const handleLogout = () => {
    setDrawerVisible(false);
    console.log('Logout');
    navigation.navigate('Home');
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
