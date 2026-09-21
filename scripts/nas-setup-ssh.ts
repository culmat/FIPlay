/**
 * Make `ssh <user>@<nas>` work without a password from this machine.
 *
 * Usage: bun run nas:setup-ssh
 *
 * 1. Uses ~/.ssh/id_ed25519(.pub), generating the pair if missing.
 * 2. If key auth already works, does nothing on the NAS.
 * 3. Otherwise appends the public key to the NAS authorized_keys, idempotently
 *    (grep before append). ssh itself prompts for the password on your
 *    terminal; this script never reads a password from env, .env or a file.
 * 4. Verifies key auth, then adds a `Host <nas>` block to ~/.ssh/config if
 *    none exists, so `ssh <nas>` works too.
 *
 * Requires in .env: FIPLAY_NAS_HOST, FIPLAY_NAS_USER
 * (Pattern: cleancentive/infrastructure/scripts/idempotato, ensure_deploy_key)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname, homedir, userInfo } from 'node:os';
import { resolve } from 'node:path';

import { abort, info, ok, run, runInherit, shq, sshOk, sshTarget, summary } from './lib';

const SSH_DIR = resolve(homedir(), '.ssh');
const KEY = resolve(SSH_DIR, 'id_ed25519');
const PUB = `${KEY}.pub`;
const CONFIG = resolve(SSH_DIR, 'config');

const { host, user, target } = sshTarget();

// --- 1. local key ----------------------------------------------------------
mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
if (!existsSync(KEY)) {
  info(`generating ${KEY}…`);
  const code = runInherit(['ssh-keygen', '-t', 'ed25519', '-N', '', '-f', KEY, '-C', `${userInfo().username}@${hostname()}`]);
  if (code !== 0) abort('ssh-keygen failed');
}
if (!existsSync(PUB)) {
  const res = await run(['ssh-keygen', '-y', '-f', KEY]);
  if (res.code !== 0) abort(`cannot derive public key: ${res.stderr}`);
  writeFileSync(PUB, `${res.stdout}\n`, { mode: 0o644 });
  info(`recreated ${PUB}`);
}
const pubKey = readFileSync(PUB, 'utf8').trim();
ok(`local key ${PUB}`);

// --- 2./3. install on the NAS -------------------------------------------------
if (await sshOk()) {
  ok(`key auth to ${target} already works`);
} else {
  console.log('');
  console.log(`Installing the key on ${target}.`);
  console.log(`You will be asked for the password of ${user} on ${host} once.`);
  console.log('');
  // POSIX sh only: the remote login shell may be plain /bin/sh.
  const remote = [
    `k=${shq(pubKey)}`,
    'd="$HOME/.ssh"',
    'f="$d/authorized_keys"',
    'mkdir -p "$d"',
    'touch "$f"',
    'if grep -qxF "$k" "$f"; then echo "key already present in $f"; else printf "%s\\n" "$k" >> "$f" && echo "key appended to $f"; fi',
    'chmod 600 "$f"',
  ].join(' && ');
  const code = runInherit([
    'ssh',
    '-o',
    'PubkeyAuthentication=no',
    '-o',
    'PreferredAuthentications=password,keyboard-interactive',
    '-o',
    'ConnectTimeout=10',
    target,
    remote,
  ]);
  if (code !== 0) abort(`could not install the key on ${target} (ssh exit ${code})`);

  // --- 4. verify --------------------------------------------------------------
  if (!(await sshOk())) {
    console.error('');
    console.error(`Key was written but key auth to ${target} still fails. Remote diagnostics (password prompt again):`);
    runInherit([
      'ssh',
      '-o',
      'PubkeyAuthentication=no',
      target,
      'echo "HOME=$HOME"; ls -la "$HOME/.ssh"; grep -iE "^(AllowUsers|PubkeyAuthentication|AuthorizedKeysFile)" /etc/ssh/sshd_config 2>/dev/null',
    ]);
    abort('see diagnostics above (typical causes: sshd AllowUsers, AuthorizedKeysFile pointing elsewhere, permissions)');
  }
  ok(`key auth to ${target} works`);
}

// --- ssh config ------------------------------------------------------------------
function configHasHost(): boolean {
  if (!existsSync(CONFIG)) return false;
  return readFileSync(CONFIG, 'utf8')
    .split('\n')
    .some((line) => {
      const m = /^\s*Host\s+(.+)$/i.exec(line);
      return m ? m[1].trim().split(/\s+/).includes(host) : false;
    });
}

if (configHasHost()) {
  ok(`~/.ssh/config already has a Host entry for ${host}`);
} else {
  const block = `\nHost ${host}\n  User ${user}\n  IdentityFile ${KEY.replace(homedir(), '~')}\n  IdentitiesOnly yes\n`;
  if (!existsSync(CONFIG)) writeFileSync(CONFIG, '', { mode: 0o600 });
  appendFileSync(CONFIG, block);
  ok(`added Host ${host} block to ~/.ssh/config`);
}

summary(`ssh ${target} and ssh ${host} work without a password`);
