import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { RootStackParamList } from '../types/NavigationTypes';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';



type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // Placeholder for login logic
    // TODO: Implement login and sync
    navigation.navigate('Settings');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to Formulus</Text>
      <TextInput
        style={styles.input}
        placeholder="Server URL"
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={styles.buttonContainer}>
        <Button title="Login" onPress={handleLogin} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 8,
  },
});

export default WelcomeScreen;
