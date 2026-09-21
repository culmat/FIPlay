# FIPlay

A small web player for [FIP](https://www.radiofrance.fr/fip) radio that can play a station
either in your browser or on [Teufel Raumfeld](https://raumfeld.com) speakers on your network.

Vue 3, Vuetify 3 and Vite. No build-time configuration: which speakers you control is decided
at runtime by a URL parameter.

## How it fits together

FIPlay is a static single-page app. It talks to two independent services, and it is the only
thing that knows about both.

| Service | What it provides | How FIPlay finds it |
| --- | --- | --- |
| [fip-metadata-server](https://github.com/culmat/fip-metadata-server) | Now-playing track, artist and cover art per station. Go, deployed on fly.io | hardcoded public URL in `src/StationWatcher.js` |
| [PyRaumfeld](https://github.com/culmat/PyRaumfeld) | HTTP API over the Raumfeld system: list zones and rooms, set volume, play a stream URL | the `?backend=` query parameter, read in `src/main.js` |

```
                 now playing          https://fip-metadata.fly.dev
  browser  ─────────────────────────▶ (Go, fly.io) ──▶ Radio France livemeta API
     │
     │  ?backend=http://<host>:<port>/
     ▼
  PyRaumfeld (Python, Docker) ──▶ Raumfeld host ──▶ speakers
```

Without a `?backend=` parameter FIPlay still works: it falls back to an `<audio>` element and
plays through the browser. With one, every zone and room the backend reports is offered as an
additional player in the footer.

The audio stream itself always comes straight from Radio France; neither service proxies it.

## Where it runs

- **GitHub Pages** at [culmat.github.io/FIPlay](https://culmat.github.io/FIPlay/), built and
  published by `.github/workflows/pipe.yaml` on every push to `main`.
- **A NAS on the local network**, whose web server serves the same static build from a
  directory, with PyRaumfeld running next to it as a Docker container. Speaker control needs
  this: the Raumfeld host is only reachable inside your LAN. Configure it in `.env` and deploy
  with `bun run deploy`.

## Getting started

Requires [Bun](https://bun.sh).

```sh
bun install
cp .env.example .env               # fill in the values for the NAS commands
bun dev                            # http://localhost:3000/FIPlay/
bunx playwright install chromium   # only needed for `bun browse`
```

`.env` holds your own host names, users and paths, and is gitignored. Every key is documented
in `.env.example`. No passwords are stored there: `bun run nas:setup-ssh` asks for the NAS
password once, interactively, and installs your SSH key instead.

## Commands

`build` and `lint` are Bun built-ins, so those two need `bun run`. The rest work either way.

| Command | What it does |
| --- | --- |
| `bun dev` | Vite dev server on port 3000 |
| `bun run build` | Production build into `dist/FIPlay` |
| `bun run lint` | ESLint with `--fix` |
| `bun browse` | Shared Chromium with remote debugging, for you and coding agents |
| `bun run deploy` | Build and rsync `dist/FIPlay` to the NAS, then verify what is served |
| `bun run nas:status` | Read-only check of deployment, backend container, and public services |
| `bun run backend <cmd>` | `status`, `logs`, `pull`, `restart`, `update` for the PyRaumfeld container |
| `bun run nas:setup-ssh` | Install your SSH key on the NAS so the other commands need no password |
| `bun run nas:ssh` | Interactive shell on the NAS |

Every command that touches the NAS refuses to run until the keys it needs are present in
`.env`, and names the missing ones.

### `bun browse`

Starts the dev server if it is not already up, then opens a browser with remote debugging on
port 9222 and a persistent profile in `.browser-profile/`, so logins and permissions survive
restarts. If a browser is already listening on that port it opens a tab in that one rather
than launching a second window, so you and an agent share a single browser.

The browser is launched through Playwright rather than by running Chrome directly. Current
Chrome builds silently ignore `--remote-debugging-port` when started by hand: no port, no
error. Playwright opens it reliably and supplies a matching Chromium, so no system Chrome
install is needed. Run `bunx playwright install chromium` once.

Coding agents attach through `.mcp.json`, which points the Playwright MCP server at the same
port. Start the browser first; the MCP server attaches to it and does not launch its own.
Screenshots and traces belong in `.playwright-mcp/` (gitignored).

### `bun run deploy`

Checks SSH and rsync on both ends, builds, writes a `version.json` next to `index.html`
recording the commit it was built from, mirrors the directory with `rsync --delete`, and then
fetches that `version.json` back over HTTP to confirm what is actually being served. Use
`--dry-run` to see the file list without changing anything.

`bun run nas:status` compares the deployed commit against your local `HEAD`, so you can tell
whether the NAS is behind without opening it.

### `bun run backend`

The PyRaumfeld container needs host networking, because it discovers the Raumfeld host over
UPnP. `bun run backend update` pulls the image and, if the digest changed, recreates the
container with exactly that configuration and waits for the API to answer again. It restarts
your speaker backend, so it is deliberately a separate command from `deploy`.

## Known issues

- **`fip_sacre_francais` never loads metadata.** The station is in FIPlay's list but not in
  the metadata server's, which answers 500. That error path sends no CORS header, so the
  browser reports it as a CORS failure rather than a 404. Fix it by adding the station in
  [fip-metadata-server](https://github.com/culmat/fip-metadata-server) or removing it here.
- **The speakers can take a minute to appear after a cold start.** On load the app calls the
  backend's `/update`, which rescans the Raumfeld network and can take 45 seconds, followed by
  a first `/zones` that can take another 15. Later calls are fast. Until that chain finishes
  the footer offers the browser player only.
