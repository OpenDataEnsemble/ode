import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import FormManagementScreen from '../screens/FormManagementScreen';
import {MainAppStackParamList} from '../types/NavigationTypes';

const Stack = createStackNavigator<MainAppStackParamList>();

const MainAppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#ffffff'},
        headerTintColor: '#000000',
        headerTitleStyle: {color: '#000000'},
      }}>
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

