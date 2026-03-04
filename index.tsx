import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { db } from './services/database';

console.log("PAL App: Starting bootstrap...");

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("PAL App: Root element not found");
    return;
  }

  // Évite le double montage si le script est chargé deux fois
  if (rootElement.hasAttribute('data-mounted')) {
    console.warn("PAL App: Already mounted.");
    return;
  }
  rootElement.setAttribute('data-mounted', 'true');

  try {
    console.log("PAL App: Initializing database...");
    // Initialisation de la couche données (Supabase / LocalStorage)
    await db.init();
    console.log("PAL App: Database initialized.");

    // Montage de l'application React
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("PAL App: React mounted successfully.");
  } catch (err) {
    console.error('PAL App: Fatal error during bootstrap:', err);
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #dc2626; font-family: sans-serif; background: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">Erreur Critique au Démarrage</h1>
          <p style="color: #4b5563; max-width: 500px;">L'application n'a pas pu s'initialiser.</p>
          <pre style="margin-top: 24px; padding: 20px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; font-size: 13px; color: #b91c1c; text-align: left; overflow: auto; max-width: 90vw;">
${err instanceof Error ? err.stack || err.message : String(err)}
          </pre>
          <button onclick="window.location.reload()" style="margin-top: 24px; padding: 12px 24px; background: #1B296F; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
            Réessayer
          </button>
        </div>
      `;
    }
  }
}

// Ensure DOM is fully loaded before bootstrapping
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}