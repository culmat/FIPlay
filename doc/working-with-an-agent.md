# Working with a coding agent on infrastructure

Notes from a session in which an agent redesigned a web app and then took it through a home
network: DNS, router, NAS web server, certificates. What made it work, what nearly did not.

## Patterns that worked

- **The shared browser.** One Chromium with remote debugging, started once, used by the
  person and the agent alike. The person logs in to the router and the NAS in it; the agent
  drives the tabs afterwards and never sees a password. Sessions stay valid across the
  agent's edits. QTS could then be operated through the requests its own UI makes, with the
  session cookie, instead of clicking through an ExtJS desktop.
- **Secrets by stdin, never by argument.** A password typed into an env file travels over
  the SSH channel on stdin and lands in a root-only file; nothing appears in a command line,
  a process list or the agent's output.
- **Preflight, apply, verify, and re-runnable.** The tool that sets up HTTPS checks the
  certificate, modules, ports and services first, backs up before editing, tests the config
  before reloading, and verifies from the outside afterwards. It is written to be run again
  after a firmware update rather than as a one-time edit, because the vendor regenerates
  config files.
- **One commit per coherent step**, with a message that says why, not what. When a step had
  to be revisited, the message of the previous one said what it had assumed.
- **Say what you are doing between tool calls.** Long sessions with silent automation are
  hard to follow and harder to interrupt.

## Things that bit

- **A scripted click is not a click.** A button positioned with a CSS transform "shook" and
  did nothing for the human, while every automated test passed. The press-feedback rule
  replaced the positioning transform, the button jumped out from under the pointer, and the
  release landed elsewhere. Automation presses and releases faster than the style applies.
  Reproduce with a held press (`mouse.down`, wait, `mouse.up`) when a human reports something
  automation cannot see.
- **Test from where the user stands.** Every check of the HTTPS setup passed from the NAS's
  own loopback. From the laptop the name did not route back into the network at all. The
  tool now asks from the client side too.
- **Do not trust the vendor's success message.** The NAS reported "Downloaded and installed
  the certificate" twice with no certificate on disk. Certificate transparency logs and the
  filesystem are the ground truth; a status code labelled "error" turned out to mean
  "finished", and vice versa.
- **Read the logs before retrying anything rate-limited.** Let's Encrypt allows five failed
  validations per hostname per hour. Each retry with a guessed parameter would have cost one.
- **Your own checks can lie.** A "reachable from here" test using a validating HTTP client
  reported a working route as dead because the certificate was still the old one. Separate
  the questions: routing with validation off, certificate on its own.
- **Hot reload desynchronises state.** A module-level flag stayed `true` after a component
  swap, so a button that only ever set the flag to `true` did nothing forever. Write state
  handlers as "sync to the desired state", not "toggle".
- **Negative DNS caches outlive your patience.** After moving the resolver, name lookups kept
  failing on the laptop for minutes while `dig` was already right. Have the address ready.
- **A resolver that is not the router forgets the router's names.** The first thing to break
  after pointing DHCP at Pi-hole was `ssh <nas>`, and with it the tooling's own default host.
- **Grepping minified bundles.** Whole-file dumps of one-line JavaScript flood the context and
  say nothing. Bounded windows around a keyword (`grep -oE ".{0,200}kw.{0,200}"`) and
  statement-splitting with `sed` read fine.
- **`grep -c` prints 0 and exits non-zero on no match.** `grep -c x f || echo 0` therefore
  prints two zeros and every "is it there" test answers yes. Use `grep -q … && echo yes ||
  echo no`.
- **Leave the world as found.** Tests that started audio, moved a speaker to another station
  or muted the laptop were undone before reporting. A speaker on a different station was
  checked against the person's own screenshot before touching it.

## What to write down

- Facts about the environment that took real time to establish and are not derivable from
  the code: carrier NAT, which config files survive a restart, which endpoint the UI calls.
- The moment a "decision" turns out to rest on a wrong assumption (no service worker,
  because "a radio cannot play offline"; true, but installability needed one anyway), and
  what the corrected reasoning is.
- The manual steps that could not be scripted, with the exact click path, so the next
  person, human or agent, does not rediscover them.
