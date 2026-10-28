import { existsSync } from 'node:fs';

// Imported first in main.ts: decorators read process.env at import time. start:prod also preloads it for OTel.
if (existsSync('.env')) process.loadEnvFile();
