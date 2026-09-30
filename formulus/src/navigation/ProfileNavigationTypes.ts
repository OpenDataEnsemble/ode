import type { NavigatorScreenParams } from '@react-navigation/native';
import type {
  MainTabParamList as BaseMainTabParamList,
  MainAppStackParamList as BaseMainAppStackParamList,
} from '../types/NavigationTypes';

// Keep the profile UI's route extension alongside its navigator.
export type MainTabParamList = BaseMainTabParamList & {
  Profiles: undefined;
};

export type MainAppStackParamList = Omit<
  BaseMainAppStackParamList,
  'MainApp'
> & {
  MainApp: NavigatorScreenParams<MainTabParamList> | undefined;
};
