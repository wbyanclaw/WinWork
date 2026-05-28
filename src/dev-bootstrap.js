// src/dev-bootstrap.js
// Browser entry for non-Tauri local runtime testing

import { createRuntime } from './runtime/create-runtime.js';
import { bootWinwork } from './main.js';

// Get local runtime (bypasses Tauri)
const runtime = createRuntime({ mode: 'local' });

// Load main bootstrap with local runtime
bootWinwork({ runtime });

console.log('[dev-bootstrap] Local runtime initialized:', runtime.kind);