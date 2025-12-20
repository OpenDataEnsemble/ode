/// <reference types="react-scripts" />

// Augment the Window interface for ReactNativeWebView and onFormInit
import { FormInitData } from './App'; // Import the specific type

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    onFormInit?: (data: FormInitData) => void; // Use the imported FormInitData type
  }
}
