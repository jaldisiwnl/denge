import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

// Self-hosted fonts (§5, §13). Only latin + latin-ext subsets: Turkish
// glyphs (ğüşiİıçö) live in latin-ext, and skipping cyrillic/greek/vietnamese
// keeps the offline precache lean (P7 slimming).
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-ext-600.css';
import '@fontsource/fraunces/latin-700.css';
import '@fontsource/fraunces/latin-ext-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';

import './styles/index.css';
import { router } from './app/router';
import { initTheme } from './app/theme';
import { db } from './db/db';
import { tr } from './i18n/tr';

initTheme();

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Opening the DB up front (instead of lazily on first query) lets us catch
// IndexedDB-unavailable environments (private mode) and show a blocking
// friendly notice rather than silently degrading (§13).
db.open()
  .then(() => {
    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    );
  })
  .catch(() => {
    root.render(
      <div className="mx-auto flex min-h-dvh max-w-md items-center bg-paper px-6">
        <p className="text-md text-ink">{tr.errors.dbUnavailable}</p>
      </div>,
    );
  });
