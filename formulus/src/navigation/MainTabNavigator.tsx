import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeScreen from '../screens/HomeScreen';
import FormsScreen from '../screens/FormsScreen';
import ObservationsScreen from '../screens/ObservationsScreen';
import SyncScreen from '../screens/SyncScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import HelpScreen from '../screens/HelpScreen';
import MoreScreen from '../screens/MoreScreen';
import {MainTabParamList} from '../types/NavigationTypes';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabBarIconProps = {
  color: string;
  size: number;
};

const renderHomeIcon = ({color, size}: TabBarIconProps) => (
  <Icon name="home" size={size} color={color} />
);

const renderFormsIcon = ({color, size}: TabBarIconProps) => (
  <Icon name="file-document-outline" size={size} color={color} />
);

const renderObservationsIcon = ({color, size}: TabBarIconProps) => (
  <Icon name="clipboard-text-outline" size={size} color={color} />
);

const renderSyncIcon = ({color, size}: TabBarIconProps) => (
  <Icon name="sync" size={size} color={color} />
);

const renderMoreIcon = ({color, size}: TabBarIconProps) => (
  <Icon name="menu" size={size} color={color} />
);

const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = 60;
  const tabBarHeight = baseTabBarHeight + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 4,
          height: tabBarHeight,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: renderHomeIcon,
        }}
      />
      <Tab.Screen
        name="Forms"
        component={FormsScreen}
        options={{
          tabBarIcon: renderFormsIcon,
        }}
      />
      <Tab.Screen
        name="Observations"
        component={ObservationsScreen}
        options={{
          tabBarIcon: renderObservationsIcon,
        }}
      />
      <Tab.Screen
        name="Sync"
        component={SyncScreen}
        options={{
          tabBarIcon: renderSyncIcon,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="About"
        component={AboutScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Help"
        component={HelpScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarIcon: renderMoreIcon,
        }}
        listeners={({navigation}) => ({
          tabPress: _e => {
            const state = navigation.getState();
            const currentRoute = state.routes[state.index];
            if (currentRoute?.name === 'More') {
              navigation.setParams({openDrawer: Date.now()});
            }
          },
        })}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
