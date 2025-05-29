import { Platform } from 'react-native';

/**
 * Reads a file from the assets directory
 * @param path Path to the file relative to the assets directory
 * @returns Promise that resolves to the file content as a string
 */
export const readAssetFile = async (path: string): Promise<string> => {
  try {
    // For Android, we'll use the file:///android_asset/ path
    const filePath = Platform.OS === 'android'
      ? `file:///android_asset/${path}`
      : path;

    console.log(`Attempting to load file from: ${filePath}`);
    
    const response = await fetch(filePath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Error reading asset file ${path}:`, error);
    throw error;
  }
};