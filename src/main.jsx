// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// ═══ HARDCODED FALLBACK (REMOVE AFTER ENV WORKS) ═══
window.VITE_GOOGLE_CLIENT_ID = '143161014607-mleat5tn3hbc6aorsdd38f201m8lo0gj.apps.googleusercontent.com'
// ═════════════════════════════════════════════════════

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)