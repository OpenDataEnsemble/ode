import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
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
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

const Tab = createBottomTabNavigator<MainTabParamList>();

type NavTokens = {
  touchTarget: { large: string; min: string };
  spacing: Record<string, string>;
  opacity: Record<string, string>;
  icon: { size: { xl: string } };
  border: { width: { thin: string } };
};
const navT = tokens as NavTokens;
const parsePx = (v: string | undefined): number =>
  parseInt(String(v ?? '').replace('px', ''), 10) || 0;

const tabBarTokens = {
  iconSize: parsePx(navT.icon?.size?.xl) || 32,
  height: parsePx(navT.touchTarget?.large) || 56,
  minTouchHeight: parsePx(navT.touchTarget?.min) || 44,
  paddingTop: parsePx(navT.spacing?.['2']) || 8,
  paddingHorizontal: parsePx(navT.spacing?.['6']) || 24,
  paddingBottomMin: parsePx(navT.spacing?.['1']) || 4,
  inactiveIconOpacity: Number(navT.opacity?.['70']) || 0.7,
  topLineHeight: parsePx(navT.border?.width?.thin) || 1,
};

type TabBarIconProps = {
  color: string;
  size: number;
  focused: boolean;
};

const iconSize = (size: number) => Math.max(size, tabBarTokens.iconSize);

const TabBarIconWrapper = ({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) =>
  focused ? (
    <>{children}</>
  ) : (
    <View style={styles.inactiveIcon}>{children}</View>
  );

const renderHomeIcon = ({ color, size, focused }: TabBarIconProps) => (
  <TabBarIconWrapper focused={focused}>
    <Icon
      name={focused ? 'home' : 'home-outline'}
      size={iconSize(size)}
      color={color}
    />
  </TabBarIconWrapper>
);

const renderFormsIcon = ({ color, size, focused }: TabBarIconProps) => (
  <TabBarIconWrapper focused={focused}>
    <Icon
      name={focused ? 'file-document' : 'file-document-outline'}
      size={iconSize(size)}
      color={color}
    />
  </TabBarIconWrapper>
);

const renderObservationsIcon = ({ color, size, focused }: TabBarIconProps) => (
  <TabBarIconWrapper focused={focused}>
    <Icon
      name={focused ? 'clipboard-text' : 'clipboard-text-outline'}
      size={iconSize(size)}
      color={color}
    />
  </TabBarIconWrapper>
);

const renderSyncIcon = ({ color, size, focused }: TabBarIconProps) => (
  <TabBarIconWrapper focused={focused}>
    <Icon name="sync" size={iconSize(size)} color={color} />
  </TabBarIconWrapper>
);

const renderMoreIcon = ({ color, size, focused }: TabBarIconProps) => (
  <TabBarIconWrapper focused={focused}>
    <Icon name="dots-vertical" size={iconSize(size)} color={color} />
  </TabBarIconWrapper>
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

const FadingTopLine = ({ borderColor }: { borderColor: string }) => {
  const { width } = useWindowDimensions();

  return (
    <Svg
      height={tabBarTokens.topLineHeight}
      width={width}
      style={[styles.fadingLineSvg, { height: tabBarTokens.topLineHeight }]}
      preserveAspectRatio="none">
      <Defs>
        <LinearGradient
          id="tabBarTopLineGradient"
          x1="0%"
          y1="0"
          x2="100%"
          y2="0"
          gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={borderColor} stopOpacity="0" />
          <Stop offset="0.15" stopColor={borderColor} stopOpacity="1" />
          <Stop offset="0.85" stopColor={borderColor} stopOpacity="1" />
          <Stop offset="1" stopColor={borderColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width="100%"
        height={tabBarTokens.topLineHeight}
        fill="url(#tabBarTopLineGradient)"
      />
    </Svg>
  );
};

const TabBarBackground = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const tabBarBackgroundColor = isDark
    ? colors.neutral[900]
    : (colors.neutral[50] as string);
  const borderColor = isDark ? themeColors.divider : colors.neutral[300];
  return (
    <View
      style={[
        styles.tabBarBackground,
        { backgroundColor: tabBarBackgroundColor },
      ]}>
      <FadingTopLine borderColor={borderColor} />
    </View>
  );
};

type CustomTabBarProps = {
  state: { routes: { name: string; key: string }[]; index: number };
  navigation: {
    dispatch: (action: object) => void;
    setParams?: (params: object) => void;
  };
  descriptors: Record<
    string,
    {
      options: {
        tabBarIcon?: (props: TabBarIconProps) => React.ReactNode;
        tabBarActiveTintColor?: string;
        tabBarInactiveTintColor?: string;
        tabBarStyle?: object;
        tabBarBackground?: () => React.ReactNode;
      };
    }
  >;
  insets: { bottom: number };
  style?: object;
};

const CustomTabBar: React.FC<CustomTabBarProps> = ({
  state,
  navigation,
  descriptors,
  insets,
  style,
}) => {
  const visibleRoutes = state.routes.filter(r =>
    (VISIBLE_MAIN_TABS as readonly string[]).includes(r.name),
  );
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute?.key]?.options ?? {};
  const {
    tabBarStyle = {},
    tabBarBackground,
    tabBarActiveTintColor = colors.brand.primary[500],
    tabBarInactiveTintColor = colors.neutral[500],
  } = focusedOptions;

  const tabBarHeight =
    tabBarTokens.height +
    Math.max(insets.bottom, tabBarTokens.paddingBottomMin);
  const containerStyle = [
    styles.customTabBarContainer,
    {
      height: tabBarHeight,
      paddingBottom: Math.max(insets.bottom, tabBarTokens.paddingBottomMin),
      paddingTop: tabBarTokens.paddingTop,
      paddingHorizontal: tabBarTokens.paddingHorizontal,
    },
    tabBarStyle,
    style,
  ];

  return (
    <View style={containerStyle}>
      {tabBarBackground && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {tabBarBackground()}
        </View>
      )}
      <View style={styles.customTabBarRow}>
        {visibleRoutes.map(route => {
          const focused = state.routes[state.index]?.key === route.key;
          const color = focused
            ? tabBarActiveTintColor
            : tabBarInactiveTintColor;
          const iconRenderer = descriptors[route.key]?.options?.tabBarIcon;
          const icon = iconRenderer
            ? iconRenderer({
                color,
                size: tabBarTokens.iconSize,
                focused,
              })
            : null;

          return (
            <Pressable
              key={route.key}
              style={styles.customTabBarItem}
              onPress={() => {
                if (route.name === 'More' && focused && navigation.setParams) {
                  navigation.setParams({ toggleDrawer: Date.now() });
                  return;
                }
                navigation.dispatch(
                  CommonActions.navigate({
                    name: route.name,
                    merge: true,
                  }) as object,
                );
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}>
              {icon}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarBackground: {
    flex: 1,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' as const } : {}),
  },
  fadingLineSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  inactiveIcon: {
    opacity: tabBarTokens.inactiveIconOpacity,
  },
  customTabBarContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  customTabBarRow: {
    flexDirection: 'row',
    width: '100%',
    flex: 1,
    alignItems: 'center',
  },
  customTabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: tabBarTokens.minTouchHeight,
  },
});

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
  const tabBarHeight =
    tabBarTokens.height +
    Math.max(insets.bottom, tabBarTokens.paddingBottomMin);

  const { themeColors, resolvedMode } = useAppTheme();
  const { tabs: configuredTabs, tabConfigPresent } = getConfiguredTabs();
  const hideTabBar = tabConfigPresent && configuredTabs.length === 0;
  const tabsToRender = hideTabBar ? (['Home'] as const) : configuredTabs;

  const tabBarBackgroundColor =
    resolvedMode === 'dark' ? 'transparent' : (colors.neutral[50] as string);

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...(props as CustomTabBarProps)} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          display: hideTabBar ? 'none' : 'flex',
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: 0,
          paddingBottom: Math.max(insets.bottom, tabBarTokens.paddingBottomMin),
          paddingTop: tabBarTokens.paddingTop,
          paddingHorizontal: tabBarTokens.paddingHorizontal,
          height: tabBarHeight,
          width: '100%',
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
                  tabPress: e => {
                    e.preventDefault();
                    const state = navigation.getState();
                    const currentRoute = state.routes[state.index];

                    if (currentRoute?.name !== 'More') {
                      // First time opening: remember where we came from.
                      (
                        navigation as unknown as {
                          navigate: (
                            name: string,
                            params?: Record<string, unknown>,
                          ) => void;
                        }
                      ).navigate('More', {
                        originTab: currentRoute?.name,
                      });
                    } else {
                      // Already on More: toggle the drawer.
                      (
                        navigation as unknown as {
                          setParams: (params: Record<string, unknown>) => void;
                        }
                      ).setParams({
                        toggleDrawer: Date.now(),
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
