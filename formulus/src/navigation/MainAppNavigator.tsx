import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-design-icons';
import MainTabNavigator from './MainTabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import ObservationDetailScreen from '../screens/ObservationDetailScreen';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { serverConfigService } from '../services/ServerConfigService';
import { loadSettingsHydrationFromStorage } from '../services/SettingsHydrationCache';
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
  return (
    <View
      style={[
        observationDetailHeaderStyles.wrapper,
        {
          backgroundColor: themeColors.surface,
          borderBottomColor: themeColors.divider as string,
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
    padding: odeSpacing.md,
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

  useEffect(() => {
    if (isConfigured === true) {
      void loadSettingsHydrationFromStorage();
    }
  }, [isConfigured]);

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
