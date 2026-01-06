import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Import tokens CSS - using package import
import '@ode/tokens/dist/css/tokens.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
