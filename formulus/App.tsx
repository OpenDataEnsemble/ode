import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HomeScreen from './src/screens/HomeScreen';
import FormManagementScreen from './src/screens/FormManagementScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouchableOpacity, View } from 'react-native';

const Stack = createStackNavigator();

const NavigationButtons = ({ navigation }: { navigation: any }) => (
  <View style={{ flexDirection: 'row' }}>
    <TouchableOpacity
      onPress={() => navigation.navigate('FormManagement')}
      style={{ marginRight: 16 }}
      accessibilityLabel="Form Management"
    >
      <Icon name="clipboard-list" size={28} color="#333" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => navigation.navigate('Home')}
      style={{ marginRight: 8 }}
      accessibilityLabel="Go to Home"
    >
      <Icon name="home" size={28} color="#333" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={{ marginRight: 8 }}
      accessibilityLabel="Go to Settings"
    >
      <Icon name="cog" size={28} color="#333" />
    </TouchableOpacity>
  </View>
);

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={({ navigation }) => ({
          headerRight: () => <NavigationButtons navigation={navigation} />,
        })}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ title: 'Welcome' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="FormManagement" component={FormManagementScreen} options={{ title: 'Form Management' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;