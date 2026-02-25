import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import HomeScreen from '../screens/HomeScreen';
import FormsScreen from '../screens/FormsScreen';
import ObservationsScreen from '../screens/ObservationsScreen';
import SyncScreen from '../screens/SyncScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import HelpScreen from '../screens/HelpScreen';
import MoreScreen from '../screens/MoreScreen';
import { colors } from '../theme/colors';
import AppConfigService from '../services/AppConfigService';
import {
  MainTabParamList,
  VisibleMainTab,
  VISIBLE_MAIN_TABS,
} from '../types/NavigationTypes';
import { useAppTheme } from '../contexts/AppThemeContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabBarIconProps = {
  color: string;
  size: number;
};

const renderHomeIcon = ({ color, size }: TabBarIconProps) => (
  <Icon name="home" size={size} color={color} />
);

const renderFormsIcon = ({ color, size }: TabBarIconProps) => (
  <Icon name="file-document-outline" size={size} color={color} />
);

const renderObservationsIcon = ({ color, size }: TabBarIconProps) => (
  <Icon name="clipboard-text-outline" size={size} color={color} />
);

const renderSyncIcon = ({ color, size }: TabBarIconProps) => (
  <Icon name="sync" size={size} color={color} />
);

const renderMoreIcon = ({ color, size }: TabBarIconProps) => (
  <Icon name="menu" size={size} color={color} />
);

const TAB_COMPONENTS: Record<
  VisibleMainTab,
  React.ComponentType<Record<string, unknown>>
> = {
  Home: HomeScreen as React.ComponentType<Record<string, unknown>>,
  Forms: FormsScreen as React.ComponentType<Record<string, unknown>>,
  Observations: ObservationsScreen as React.ComponentType<
    Record<string, unknown>
  >,
  Sync: SyncScreen as React.ComponentType<Record<string, unknown>>,
  More: MoreScreen as React.ComponentType<Record<string, unknown>>,
};

const TAB_ICONS: Record<
  VisibleMainTab,
  (props: TabBarIconProps) => React.ReactElement
> = {
  Home: renderHomeIcon,
  Forms: renderFormsIcon,
  Observations: renderObservationsIcon,
  Sync: renderSyncIcon,
  More: renderMoreIcon,
};

const isVisibleMainTab = (value: string): value is VisibleMainTab =>
  (VISIBLE_MAIN_TABS as readonly string[]).includes(value);

const getConfiguredTabs = (): {
  tabs: VisibleMainTab[];
  tabConfigPresent: boolean;
} => {
  const config = AppConfigService.getInstance().getConfig();
  const requestedTabs = config?.navigation?.tabs;

  if (requestedTabs === undefined) {
    return { tabs: [...VISIBLE_MAIN_TABS], tabConfigPresent: false };
  }

  if (!Array.isArray(requestedTabs)) {
    console.warn(
      '[Navigation] app.config.json navigation.tabs must be an array. Falling back to defaults.',
    );
    return { tabs: [...VISIBLE_MAIN_TABS], tabConfigPresent: true };
  }

  const tabs = requestedTabs.filter(tab => {
    const isValid = isVisibleMainTab(tab);
    if (!isValid) {
      console.warn(
        `[Navigation] Invalid tab "${tab}" in app.config.json. Skipping.`,
      );
    }
    return isValid;
  });

  return { tabs, tabConfigPresent: true };
};

const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = 60;
  const tabBarHeight = baseTabBarHeight + insets.bottom;

  // Theme colors come from AppThemeContext — they update automatically
  // when the custom app's config is loaded or the color scheme changes.
  const { themeColors } = useAppTheme();
  const { tabs: configuredTabs, tabConfigPresent } = getConfiguredTabs();
  const hideTabBar = tabConfigPresent && configuredTabs.length === 0;
  const tabsToRender = hideTabBar ? (['Home'] as const) : configuredTabs;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarStyle: {
          display: hideTabBar ? 'none' : 'flex',
          backgroundColor: themeColors.surface,
          borderTopWidth: 1,
          borderTopColor: themeColors.divider,
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 4,
          height: tabBarHeight,
        },
      }}>
      {tabsToRender.map(tabName => (
        <Tab.Screen
          key={tabName}
          name={tabName}
          component={TAB_COMPONENTS[tabName]}
          options={{
            tabBarIcon: TAB_ICONS[tabName],
          }}
          listeners={
            tabName === 'More'
              ? ({ navigation }) => ({
                  tabPress: () => {
                    const state = navigation.getState();
                    const currentRoute = state.routes[state.index];
                    if (currentRoute?.name === 'More') {
                      (
                        navigation as { setParams: (params: object) => void }
                      ).setParams({
                        openDrawer: Date.now(),
                      });
                    }
                  },
                })
              : undefined
          }
        />
      ))}
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
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
