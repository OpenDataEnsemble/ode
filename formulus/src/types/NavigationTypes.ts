export type MainTabParamList = {
  Home: undefined;
  Forms: undefined;
  Observations: undefined;
  Sync: undefined;
  About: undefined;
  More: {openDrawer?: number} | undefined;
};

export type MainAppStackParamList = {
  Welcome: undefined;
  MainApp: undefined;
  Settings: undefined;
  FormManagement: undefined;
  ObservationDetail: {observationId: string};
};
