import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from '../types/NavigationTypes';
import {Button} from '../components/common';
import {appVersionService} from '../services/AppVersionService';

type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const version = await appVersionService.getVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('Failed to load app version:', error);
        setAppVersion('0.0.1'); // Fallback version
      }
    };
    loadVersion();
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('ServerConfiguration');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://example.com/privacy-policy').catch(err =>
      console.error('Failed to open privacy policy:', err),
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.tagline}>
          Professional Data Collection for Field Work
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="large"
            fullWidth
            testID="welcome-get-started-button"
          />
          <Button
            title="Sign In"
            onPress={handleSignIn}
            variant="secondary"
            size="large"
            fullWidth
            testID="welcome-sign-in-button"
          />
        </View>

        <View style={styles.footer}>
          {appVersion ? (
            <Text style={styles.versionText}>Version {appVersion}</Text>
          ) : null}
          <TouchableOpacity
            onPress={handlePrivacyPolicy}
            style={styles.privacyLink}
            testID="welcome-privacy-policy-link">
            <Text style={styles.privacyLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logoContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  tagline: {
    fontSize: 18,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 48,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '400',
  },
  privacyLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  privacyLinkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default WelcomeScreen;
