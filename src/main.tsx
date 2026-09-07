import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { RecordSyncBoundary } from './components/RecordSyncBoundary';
import { flushAnalytics } from './lib/analytics';
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const tree = (
  <ErrorBoundary scope="root">
    <BrowserRouter>
      <AuthProvider>
        <RecordSyncBoundary>
          <App />
        </RecordSyncBoundary>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

createRoot(root).render(import.meta.env.PROD ? tree : <StrictMode>{tree}</StrictMode>);

const scheduleMonitoring = () => {
  void import('./lib/foundry-monitoring').then((m) => m.installBrowserMonitoring());
  flushAnalytics();
};
if ('requestIdleCallback' in window) {
  requestIdleCallback(scheduleMonitoring, { timeout: 3000 });
} else {
  setTimeout(scheduleMonitoring, 1);
}

const scheduleVitals = () => {
  void import('./lib/vitals').then((m) => m.initVitals()).catch(() => {});
};
if ('requestIdleCallback' in window) {
  requestIdleCallback(scheduleVitals, { timeout: 3000 });
} else {
  setTimeout(scheduleVitals, 1);
}

const scheduleApiTiming = () => {
  void import('./lib/api-timing').then((m) => m.initApiTiming()).catch(() => {});
};
if ('requestIdleCallback' in window) {
  requestIdleCallback(scheduleApiTiming, { timeout: 3000 });
} else {
  setTimeout(scheduleApiTiming, 1);
}
