/**
 * Open an interactive shell on the NAS using the host/user from .env.
 *
 * Usage: bun run nas:ssh
 */
import { runInherit, sshTarget } from './lib';

const { target } = sshTarget();
process.exit(runInherit(['ssh', '-t', target]));
