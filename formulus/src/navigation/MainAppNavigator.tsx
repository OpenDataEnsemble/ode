import React, { useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MainTabNavigator from './MainTabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import ObservationDetailScreen from '../screens/ObservationDetailScreen';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { serverConfigService } from '../services/ServerConfigService';
import { colors } from '../theme/colors';

const Stack = createStackNavigator<MainAppStackParamList>();

const MainAppNavigator: React.FC = () => {
  const navigation = useNavigation();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkConfiguration = async () => {
      const serverUrl = await serverConfigService.getServerUrl();
      setIsConfigured(!!serverUrl);
    };
    checkConfiguration();
  }, []);

  // Handle Android hardware back button in a conservative way:
  // only intercept when there is actual stack history above the root.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const onBackPress = () => {
      const state = navigation.getState?.();

      // Only handle back when we're in a stack with more than one route and
      // not at the root (index > 0). This avoids interfering with tab presses
      // and prevents the app from getting into an odd state.
      if (
        state &&
        state.type === 'stack' &&
        Array.isArray(state.routes) &&
        state.routes.length > 1 &&
        typeof state.index === 'number' &&
        state.index > 0
      ) {
        navigation.goBack();
        return true;
      }

      // Let React Navigation / Android handle back normally (may exit app at root)
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => {
      subscription.remove();
    };
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      const checkConfig = async () => {
        const serverUrl = await serverConfigService.getServerUrl();
        setIsConfigured(!!serverUrl);
      };
      checkConfig();
    }, []),
  );

  if (isConfigured === null) {
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.neutral.white },
        headerTintColor: colors.neutral.black,
        headerTitleStyle: { color: colors.neutral.black },
      }}
      initialRouteName={isConfigured ? 'MainApp' : 'Welcome'}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainApp"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ObservationDetail"
        component={ObservationDetailScreen}
        options={{ title: 'Observation Details' }}
      />
    </Stack.Navigator>
  );
};

export default MainAppNavigator;
