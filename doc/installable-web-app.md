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
- Never reload the page automatically when a new worker is found. For anything playing media,
  let the new version take over when all tabs are closed.
- Register the worker only when `window.isSecureContext` is true. On the http copy the API
  is not even exposed, and asking anyway logs an error nobody can act on.
- Keep the version file and the manifest out of any cache, so a deploy can prove what is
  being served and the install start URL is always current.
- If the app is served from more than one place (a public host and a LAN one), the manifest
  can differ per copy: stamp deploy-specific values such as `start_url` query parameters at
  deploy time rather than committing them.

## How to verify without a phone

- `curl` the built `index.html`: every link and meta tag present, hrefs carrying the base path.
- Load the site over HTTPS in a desktop browser: `navigator.serviceWorker.getRegistrations()`
  returns one active registration with the right scope, `isSecureContext` is true, the
  manifest fetches as `application/manifest+json`.
- Load the http copy: no worker, no error, app still works.
- Only the install itself needs the device.
