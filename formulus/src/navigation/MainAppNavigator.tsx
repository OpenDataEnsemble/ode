import React, {useEffect, useState} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useFocusEffect} from '@react-navigation/native';
import MainTabNavigator from './MainTabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FormManagementScreen from '../screens/FormManagementScreen';
import {MainAppStackParamList} from '../types/NavigationTypes';
import {serverConfigService} from '../services/ServerConfigService';

const Stack = createStackNavigator<MainAppStackParamList>();

const MainAppNavigator: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  const checkConfiguration = async () => {
    const serverUrl = await serverConfigService.getServerUrl();
    setIsConfigured(!!serverUrl);
  };

  useEffect(() => {
    checkConfiguration();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      checkConfiguration();
    }, []),
  );

  if (isConfigured === null) {
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#ffffff'},
        headerTintColor: '#000000',
        headerTitleStyle: {color: '#000000'},
      }}
      initialRouteName={isConfigured ? 'MainApp' : 'Welcome'}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MainApp"
        component={MainTabNavigator}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
      <Stack.Screen
        name="FormManagement"
        component={FormManagementScreen}
        options={{title: 'Form Management'}}
      />
    </Stack.Navigator>
  );
};

export default MainAppNavigator;
