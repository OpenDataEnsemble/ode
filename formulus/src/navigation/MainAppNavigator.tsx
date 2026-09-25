import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import MainTabNavigator from './MainTabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import ObservationDetailScreen from '../screens/ObservationDetailScreen';
import { MainAppStackParamList } from './ProfileNavigationTypes';
import { useProfiles } from './useProfiles';
import { consumeProfilesNavigationIntent } from './ProfileNavigationIntent';
import { useAppTheme } from '../contexts/AppThemeContext';
import { ThemeColors } from '../types/AppConfig';
import {
  odeSpacing,
  odeBorderWidth,
  odeTypography,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import colors from '../theme/colors';

const Stack = createStackNavigator<MainAppStackParamList>();

function ObservationDetailHeader({
  navigation,
  themeColors,
}: {
  navigation: { goBack: () => void };
  themeColors: ThemeColors;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        observationDetailHeaderStyles.wrapper,
        {
          backgroundColor: themeColors.surface,
          borderBottomColor: themeColors.divider as string,
          paddingTop: insets.top + odeSpacing.md,
        },
      ]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={observationDetailHeaderStyles.backBtn}>
        <Icon name="arrow-left" size={24} color={themeColors.primary} />
      </TouchableOpacity>
      <Text
        style={[
          observationDetailHeaderStyles.title,
          { color: themeColors.onBackground },
        ]}
        numberOfLines={1}>
        Observation Details
      </Text>
      <View style={observationDetailHeaderStyles.placeholder} />
    </View>
  );
}

const observationDetailHeaderStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: odeSpacing.md,
    paddingBottom: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    overflow: 'visible',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
    minHeight: odeScreenHeaderHeight,
    width: '100%',
  },
  backBtn: {
    padding: odeSpacing.xxs,
    marginRight: odeSpacing.xs,
  },
  title: {
    flex: 1,
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  placeholder: {
    width: 24 + odeSpacing.xxs * 2 + odeSpacing.xs,
  },
});

const MainAppNavigator: React.FC = () => {
  const { activeProfile } = useProfiles();
  const isConfigured = !!activeProfile.serverUrl;
  const [openProfiles, setOpenProfiles] = useState<boolean | null>(null);
  const startupProfilesIntent = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    startupProfilesIntent.current ??= consumeProfilesNavigationIntent();
    void startupProfilesIntent.current.then(open => {
      if (!cancelled) setOpenProfiles(open);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme colors come from AppThemeContext — they update automatically
  // when the custom app's config is loaded or the color scheme changes.
  const { themeColors } = useAppTheme();

  if (openProfiles === null) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: themeColors.surface },
        headerTintColor: themeColors.onBackground,
        headerTitleStyle: { color: themeColors.onBackground },
      }}
      initialRouteName={openProfiles || isConfigured ? 'MainApp' : 'Welcome'}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainApp"
        component={MainTabNavigator}
        initialParams={openProfiles ? { screen: 'Profiles' } : undefined}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ObservationDetail"
        component={ObservationDetailScreen}
        options={{
          title: 'Observation Details',
          headerTransparent: true,
          headerStyle: { backgroundColor: colors.neutral.transparent },
          header: props => (
            <ObservationDetailHeader
              navigation={props.navigation}
              themeColors={themeColors}
            />
          ),
        }}
      />
    </Stack.Navigator>
  );
};

export default MainAppNavigator;
