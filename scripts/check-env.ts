/**
 * Preflight: ensure a local .env exists.
 *
 * Copies .env.example to .env on a fresh clone so every FIPLAY_* key is
 * visible with its comment. Values stay empty until the developer fills them
 * in; scripts that need them abort with the exact key names when they run.
 *
 * Never writes secrets: `bun run nas:setup-ssh` prompts for the NAS password.
 * No-op once .env exists. Idempotent: safe on every `bun dev` / `bun browse`.
 * (Pattern: cleancentive/infrastructure/check-env.ts)
 */
import { copyFileSync, existsSync } from 'node:fs';

import { ENV_EXAMPLE, ENV_FILE } from './lib';

if (!existsSync(ENV_FILE)) {
  if (!existsSync(ENV_EXAMPLE)) {
    console.error('.env.example is missing; cannot bootstrap .env');
    process.exit(1);
  }
  copyFileSync(ENV_EXAMPLE, ENV_FILE);
  console.log('Created .env from .env.example. Fill in the FIPLAY_* values before using NAS commands.');
}
