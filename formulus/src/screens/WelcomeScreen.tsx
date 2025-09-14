import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { RootStackParamList } from '../types/NavigationTypes';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';



type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();



  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to Formulus</Text>
    
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => navigation.navigate('Home')}
        >
          <Icon name="home" size={32} color="#fff" />
          <Text style={styles.buttonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="settings" size={32} color="#fff" />
          <Text style={styles.buttonText}>Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => navigation.navigate('FormManagement')}
        >
          <Icon name="description" size={32} color="#fff" />
          <Text style={styles.buttonText}>Form Management</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => navigation.navigate('Sync')}
        >
          <Icon name="sync" size={32} color="#fff" />
          <Text style={styles.buttonText}>Sync</Text>
        </TouchableOpacity>
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
    gap: 16,
  },
  iconButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
});

export default WelcomeScreen;
