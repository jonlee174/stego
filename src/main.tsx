import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DecksProvider } from './state/decks';
import { AccountProvider } from './state/account';
import { ToastProvider } from './components/Toast';
import { applyStoredTheme, syncSystemChrome } from './state/theme';
import './styles/theme.css';
import './styles/screens.css';

applyStoredTheme();

if (typeof window !== 'undefined' && window.stegoDesktop) {
  document.body.classList.add('is-desktop');
  // Only inset the bar while the traffic lights are really sitting on the page.
  window.stegoDesktop.onTrafficLights((overlapping) => {
    document.body.classList.toggle('has-traffic-lights', overlapping);
  });
}

requestAnimationFrame(syncSystemChrome);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DecksProvider>
        {/* Account sits inside Decks because syncing reads and replaces the
            library it holds. */}
        <AccountProvider>
          <App />
        </AccountProvider>
      </DecksProvider>
    </ToastProvider>
  </StrictMode>,
);
