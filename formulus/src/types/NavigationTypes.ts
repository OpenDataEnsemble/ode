export type RootStackParamList = {
    Auth: undefined;
    MainApp: undefined;
};

export type AuthStackParamList = {
    Welcome: undefined;
    ServerConfiguration: undefined;
    Login: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Forms: undefined;
    Observations: undefined;
    Sync: undefined;
    More: {openDrawer?: number} | undefined;
};

export type MainAppStackParamList = {
    MainApp: undefined;
    Settings: undefined;
    FormManagement: undefined;
    Profile: undefined;
    About: undefined;
    Help: undefined;
    PrivacyPolicy: undefined;
};