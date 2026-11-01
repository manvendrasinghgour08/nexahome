import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlashProvider } from './state/flash';
import { StoreProvider } from './state/store';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <BrowserRouter>
          <FlashProvider>
            <App />
          </FlashProvider>
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
