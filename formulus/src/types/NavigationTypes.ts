export type MainTabParamList = {
  Home: undefined;
  Forms: undefined;
  Observations: undefined;
  Sync: undefined;
  Settings: undefined;
  About: undefined;
  Help: undefined;
  More:
    | {
        openDrawer?: number;
        toggleDrawer?: number;
        originTab?: VisibleMainTab;
      }
    | undefined;
};

export const VISIBLE_MAIN_TABS = [
  'Home',
  'Forms',
  'Observations',
  'Sync',
  'More',
] as const;

export type VisibleMainTab = (typeof VISIBLE_MAIN_TABS)[number];

export type MainAppStackParamList = {
  Welcome: undefined;
  MainApp: undefined;
  ObservationDetail: { observationId: string };
};
