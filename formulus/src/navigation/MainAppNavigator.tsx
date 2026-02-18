import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MainTabNavigator from './MainTabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import ObservationDetailScreen from '../screens/ObservationDetailScreen';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { serverConfigService } from '../services/ServerConfigService';
import { useAppTheme } from '../contexts/AppThemeContext';

const Stack = createStackNavigator<MainAppStackParamList>();

const MainAppNavigator: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Theme colors come from AppThemeContext — they update automatically
  // when the custom app's config is loaded or the color scheme changes.
  const { themeColors } = useAppTheme();

  useEffect(() => {
    const checkConfiguration = async () => {
      const serverUrl = await serverConfigService.getServerUrl();
      setIsConfigured(!!serverUrl);
    };
    checkConfiguration();
  }, []);

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
        headerStyle: { backgroundColor: themeColors.surface },
        headerTintColor: themeColors.onBackground,
        headerTitleStyle: { color: themeColors.onBackground },
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
