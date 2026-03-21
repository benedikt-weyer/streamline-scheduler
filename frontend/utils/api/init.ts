/**
 * Initialize the backend implementation
 * This should be called once at app startup
 */

import { initializeBackend } from './backend-interface';
import RustBackendImpl from './rust-backend-impl';

// Initialize immediately with defaults so getBackend() never throws.
// The real URLs are fetched from /api/config at runtime (server-side env vars
// prefixed with PUBLIC_ — not baked in at build time like NEXT_PUBLIC_).
const rustBackend = new RustBackendImpl('http://localhost:3001', 'ws://localhost:3001');
initializeBackend(rustBackend);

// Fetch runtime config and update URLs before any user interaction occurs.
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((res) => res.json())
    .then((config) => {
      rustBackend.updateUrls(config.backendHttpUrl, config.backendWsUrl);
    })
    .catch((err) => {
      console.warn('[init] Failed to fetch runtime config, using defaults:', err);
    });
}

export { rustBackend };
