import React from 'react';
import ReactDOM from 'react-dom/client';
import * as MUI from '@mui/material';
import './index.css';
import App from './App';

// Expose React and MaterialUI to global scope for custom question type renderers
// This MUST happen at the entry point before any other code runs
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).MaterialUI = MUI;
<<<<<<< HEAD
  // Only log in development mode
  if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
    console.log(
      '[index] Exposed React and MaterialUI to global scope for custom renderers',
    );
  }
=======
  console.log(
    '[index] Exposed React and MaterialUI to global scope for custom renderers',
  );
>>>>>>> 25a737e (chore: apply prettier formatting fixes)
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(<App />);
