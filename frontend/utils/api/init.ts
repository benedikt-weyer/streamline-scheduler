/**
 * Initialize the backend implementation
 * This should be called once at app startup
 */

import { initializeBackend } from './backend-interface';
import RustBackendImpl from './rust-backend-impl';

// Get backend URLs from environment variables
const BACKEND_HTTP_URL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL || 'http://localhost:3001';
const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:3001';

// Initialize the backend implementation
const rustBackend = new RustBackendImpl(BACKEND_HTTP_URL, BACKEND_WS_URL);

// Set it as the global backend
initializeBackend(rustBackend);

export { rustBackend };
