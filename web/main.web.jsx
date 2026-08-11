// Nexbit POS Web - Entry point (Vite)
// Compila la MISMA UI de escritorio + el adaptador web en lugar de IPC.
// El adaptador debe quedar definido ANTES que App para que no caiga en mockApi.
import './adapter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../src/renderer/components/ErrorBoundary';
import { ThemeProvider } from '../src/renderer/styles/theme';
import App from '../src/renderer/App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ErrorBoundary>
);