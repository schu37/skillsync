import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

// Google OAuth Client ID - set in .env.local as VITE_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Only wrap with GoogleOAuthProvider if client ID is configured
// This prevents crashes when OAuth isn't set up yet
const AppWithProviders = GOOGLE_CLIENT_ID ? (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

root.render(
  <React.StrictMode>
    {AppWithProviders}
  </React.StrictMode>
);
