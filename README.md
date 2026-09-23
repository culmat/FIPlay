# FIPlay

A small web player for [FIP](https://www.radiofrance.fr/fip) radio that can play a station
either in your browser or on [Teufel Raumfeld](https://raumfeld.com) speakers on your network.

Vue 3 and Vite, with no UI framework: the interface is a handful of components over CSS
custom properties, and the icons are inline SVG paths from `@mdi/js`. No build-time
configuration: which speakers you control is decided at runtime by a URL parameter.

It installs to a phone's home screen and runs full screen, with the artwork of the current
track as the backdrop.

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
additional output in the output picker.

Outputs are independent switches, not a single choice: the browser and any number of zones can
play at once, each with its own volume, and the transport applies to all of them together. They
are separate connections to a live stream, so two outputs start a second or two apart and stay
that way. For synchronised rooms, group them into one Raumfeld zone and pick that.

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
| `bun run icons` | Re-render `public/icons/*.png` from the SVG source |
| `bun browse` | Shared Chromium with remote debugging, for you and coding agents |
| `bun run deploy` | Build and rsync `dist/FIPlay` to the NAS, then verify what is served |
| `bun run nas:status` | Read-only check of deployment, backend container, and public services |
| `bun run nas:https` | Serve the app over HTTPS on the NAS, with the speaker API on the same origin |
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

### Installing it on a phone

The build ships a web app manifest, maskable icons and the iOS meta tags, so Safari's
*Add to Home Screen* and Chrome's install prompt give a full-screen app with a dark splash
screen and no browser chrome. The layout keeps its controls clear of the notch and the home
indicator through `env(safe-area-inset-*)`, which needs the `viewport-fit=cover` in
`index.html` to resolve to anything.

Two things are needed for that, and both are easy to miss:

- **A service worker.** Without one, Firefox and Chrome on Android treat *Add to Home Screen*
  as a bookmark: it opens in a tab, with the address bar, and the status bar keeps the
  browser's colour instead of the manifest's `theme_color`. The manifest alone is not enough.
  FIPlay's worker only precaches the app shell. Everything that matters at runtime, the
  metadata, the artwork, the audio stream and the speaker backend, is cross-origin and goes
  to the network, so there is nothing to serve stale. A new build takes over once every tab
  of the app is closed, which is deliberate: a radio should not reload itself mid-track.
- **A secure origin.** Service workers and installability both require HTTPS. `localhost`
  counts, a plain `http://` LAN address does not. So the GitHub Pages copy installs, and a
  NAS served over plain HTTP will always open in a browser tab however good the manifest is.
  FIPlay only registers the worker when the origin is secure, rather than logging a failure
  nobody can act on.

Note that the two copies cannot simply be swapped for each other. A page served over HTTPS may
not call an `http://` backend, so the GitHub Pages copy can install but cannot reach speakers
on your network. Putting both the app and the PyRaumfeld API behind HTTPS on the same origin
is what gets the installed app and the speakers at once.

`bun run icons` regenerates the PNGs from one SVG defined in `scripts/icons.ts`, rendering
them with the Chromium that `bun browse` already needs. The PNGs are committed, so a home
screen icon never depends on anyone's toolchain.

An installed app launches at the manifest's `start_url`, which carries no query string and so
would come up without speakers. `bun run deploy` therefore stamps `?backend=` from your `.env`
into the manifest it uploads; the GitHub Pages build has no backend and stays as it is.

### `bun run nas:https`

Installing the app from the NAS needs HTTPS, and plain HTTP is what the NAS serves by
default. This command sets up the missing half: an Apache virtual host with TLS on port 4433,
and a proxy that answers the PyRaumfeld API on a path of that same origin, because a page
served over TLS may not call an `http://` address. Same origin also means no CORS. The app is
then opened with `?backend=/pyraumfeld/`, and `bun run deploy` writes that into the manifest
so an installed copy starts with the speakers already reachable.

Run `bun run nas:https --check` first: it reports the certificate, the modules, the port and
whether PyRaumfeld is answering, and changes nothing. The certificate is yours to provide, at
`/etc/stunnel/stunnel.pem` (QTS writes it there via *Control Panel > Security > SSL
Certificate & Private Key*). It must be valid and match the hostname the phone uses, or the
browser refuses the site outright, which also means no service worker and no install.

The command is written to be re-run, for a reason worth knowing: QNAP regenerates the files
under `/etc/config/apache/extra/` from its own settings on every web server restart, so an
`Include` added there is gone the moment the server comes back. The one in `apache.conf`
survives a restart but not necessarily a firmware update, which is the likeliest reason a
working HTTPS site on a QNAP goes quiet by itself. Run it again and it is back.

The proxy path is deliberately configured at server level rather than inside the TLS virtual
host, so it answers over plain HTTP too. One manifest then works either way, and the setup can
be tested before a certificate is in place.

If your own metadata service runs on the NAS as well, set `FIPLAY_METADATA_PORT` and it is
proxied onto the same origin under `FIPLAY_METADATA_PATH`, and `bun run deploy` builds the app
against that path. Otherwise an app served over HTTPS could not fetch from an `http://` service
on the same box, for the same mixed-content reason as the speaker API.

If the resolver you point the router at is not the router itself, make sure it hands the
router's own names back to it. A Pi-hole, for instance, does not know the names of your DHCP
clients, so `nas` and `nas.fritz.box` stop resolving the moment devices switch to it unless it
forwards that zone and unqualified names to the router.

**Renewal.** QTS's own Let's Encrypt agent can validate a myQNAPcloud name over DNS, which is
what a carrier-NAT connection needs, but its wrapper lost the issued certificate in
post-processing and reported success regardless. The Python ACME client inside it works on its
own, so [scripts/nas/renew-cert.sh](scripts/nas/renew-cert.sh) drives that client directly and
installs the result into `/etc/stunnel/`, where the vhost reads it. It lives on the NAS next to
the certificate files and runs from QNAP's crontab on the first of each month, renewing when
fewer than 30 days remain. It logs to `renew.log` beside it.

The last phase checks the address from the machine you run it on, not only from the NAS,
because those are different questions. A certificate names a public hostname, that hostname
resolves to your public address, and a home router will not necessarily route a request from
inside the network back in to itself. If that check fails, the server is fine and the route is
not: forward the port and rely on the router routing back in, or make the name resolve to the
NAS's own address while you are at home.

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
  the output picker offers the browser player only.
