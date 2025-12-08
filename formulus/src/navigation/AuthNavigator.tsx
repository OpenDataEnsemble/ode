import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import ServerConfigurationScreen from '../screens/ServerConfigurationScreen';
import LoginScreen from '../screens/LoginScreen';
import {AuthStackParamList} from '../types/NavigationTypes';

const Stack = createStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  onLogin?: () => void;
}

const AuthNavigator: React.FC<AuthNavigatorProps> = ({onLogin}) => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="ServerConfiguration"
        component={ServerConfigurationScreen}
        options={{title: 'Server Configuration'}}
      />
      <Stack.Screen name="Login">
        {props => <LoginScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AuthNavigator;

