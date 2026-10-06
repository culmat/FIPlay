# Installable web app: what a phone actually requires

## The problem

Two web apps on the same phone, both with a manifest: one installs from the browser menu and
runs full screen with a tinted status bar, the other opens in a browser tab with the address
bar showing, however the manifest is tuned.

## What turned out to be true

A phone installs a web app, rather than bookmarking it, only when three things hold at once:

1. **A web app manifest** with `name`, `start_url`, `display: standalone` (or fullscreen) and
   PNG icons of 192 and 512 pixels, plus a 512 `maskable` one for Android's icon shapes.
2. **A registered service worker.** Without one, Firefox and Chrome on Android hand out a
   bookmark. The worker can be a precache of the app shell and nothing else.
3. **A secure origin.** Service workers and installability both need HTTPS. `localhost`
   counts; a plain `http://` LAN address does not, however good the rest is.

Some consequences that are easy to miss:

- The status bar colour of an installed Android app comes from the **manifest's**
  `theme_color`. The `<meta name="theme-color">` tag is for the browser tab. An app with no
  meta tag at all can still get a perfectly tinted status bar once installed.
- `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to anything. Without it
  the layout never reaches the edges and the insets are zero.
- **Mixed content is the trap on the second step.** An HTTPS page may not fetch from an
  `http://` address. If the app talks to services on the home network over plain HTTP, adding
  TLS to the app alone breaks it. Every service it needs has to answer on an HTTPS origin,
  most simply the app's own, via a reverse proxy path. Same origin also disposes of CORS.
- iOS never needed a service worker to install, but it needs the `apple-mobile-web-app-*`
  meta tags and an `apple-touch-icon`. Ship both sets; the platform that ignores one is not
  harmed by it.

## What to do

- Precache only the shell. If the app's whole purpose is a live network resource (a radio,
  a camera), there is nothing meaningful to serve offline, and runtime caching rules are a
  place to get stale data wrong. Cross-origin requests bypass a precache-only worker anyway.
- A precached shell opens away from home too, so decide what the app does when its home
  services are out of reach. There is no API that says "WLAN is off", and a request to an
  address that never answers waits for the browser's connect timeout, most of a minute on a
  phone: the page looks broken. Probe the home server with a fixed timeout, fall back to
  something public, and remember the answer so the next launch does not wait even that long.
- Do not leave updates to the worker's default either. By itself a new version waits until
  every window is closed. On Firefox for Android that never happens: swiping the app away does
  not end its process, and a browser tab of the same site counts as a window, so the old
  version persists indefinitely. Build the worker with `skipWaiting` and `clientsClaim` so it
  takes over the moment it has downloaded, and decide in the page what to do when it does:
  reload at once when the page is not playing anything itself, offer a "Restart" when it is.
  Check for updates when the app returns to the foreground and on a timer, not only at
  navigation. The one hazard of taking over early, an old page lazy-loading a chunk that no
  longer exists, is covered by reloading once on a failed dynamic import. Show the build's commit in the UI: with a worker between phone and
  server it is the only honest answer to "which version is this".
- Remote players (speakers) are unaffected by a reload, so they need no protection; the local
  `<audio>` element is what an unasked reload would interrupt.
- Register the worker only when `window.isSecureContext` is true. On the http copy the API
  is not even exposed, and asking anyway logs an error nobody can act on.
- Keep the version file and the manifest out of any cache, so a deploy can prove what is
  being served and the install start URL is always current.
- If the app is served from more than one place (a public host and a LAN one), the manifest
  can differ per copy: stamp deploy-specific values such as `start_url` query parameters at
  deploy time rather than committing them.
- The phone's back button is the installed app's only navigation, and it works on the page's
  history. When that runs out, Firefox for Android does not close the app: the window stays,
  empty and dead, and the page is never asked. So in standalone mode keep one entry under the
  first page (FIPlay uses a `#base` fragment on the launch route, see `src/back.js`) and put
  the first page back on top whenever back lands on it. Back on the first page then stays
  there, and back from a page the app opened by itself goes home. `(display-mode: standalone)`
  tells the installed app from a tab: Firefox applies the manifest's `display` to the session.
- Make sure the app builds history at all. A vue-router guard that redirects with
  `replace: true` (to carry a query parameter along, say) turns every push into a replace, and
  the app then lives on a single entry: one back press and it is gone. Measure `history.length`
  after a tap before blaming the browser.
- The white moment before an installed app's first paint on Firefox for Android is the
  browser's own clear colour, taken from its theme, not the page's background or the manifest's
  `background_color`. Dark mode on the device is the only thing that changes it.

## How to verify without a phone

- `curl` the built `index.html`: every link and meta tag present, hrefs carrying the base path.
- Load the site over HTTPS in a desktop browser: `navigator.serviceWorker.getRegistrations()`
  returns one active registration with the right scope, `isSecureContext` is true, the
  manifest fetches as `application/manifest+json`.
- Load the http copy: no worker, no error, app still works.
- Back: open a page from the first one and check that `history.length` grew by one and
  `history.state.back` names the page you came from.
- Only the install itself needs the device.
