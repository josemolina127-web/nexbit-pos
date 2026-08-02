import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './styles/theme';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
} else {
  document.body.innerHTML = '<div style="padding:40px;color:red;font-family:monospace">Error: #root no encontrado</div>';
}
