export type MainTabParamList = {
  Home: undefined;
  Forms: undefined;
  Observations: undefined;
  Sync: undefined;
  More: {openDrawer?: number} | undefined;
};

export type MainAppStackParamList = {
  Welcome: undefined;
  MainApp: undefined;
  Settings: undefined;
  FormManagement: undefined;
  ObservationDetail: {observationId: string};
};
