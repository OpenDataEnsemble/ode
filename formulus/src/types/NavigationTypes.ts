export type MainTabParamList = {
  Home: undefined;
  Forms: undefined;
  Observations: undefined;
  Sync: undefined;
  Settings: undefined;
  About: undefined;
  Help: undefined;
  More: {openDrawer?: number} | undefined;
};

export type MainAppStackParamList = {
  Welcome: undefined;
  MainApp: undefined;
  FormManagement: undefined;
  ObservationDetail: {observationId: string};
};
