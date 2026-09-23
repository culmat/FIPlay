# Notes from the field

Lessons from getting FIPlay to install on a phone as a full-screen app while its speakers
live on a home network with no inbound internet. Most of it is not about FIPlay at all. Each
note states the problem, what turned out to be true, and what to do; the specifics that are
tied to one house (names, addresses, ports) are left out on purpose.

| note | in one line |
| --- | --- |
| [Installable web app](installable-web-app.md) | A manifest is not enough. HTTPS and a service worker decide whether a phone installs or bookmarks, and the manifest colours only apply once installed. |
| [HTTPS at home behind carrier NAT](https-at-home-behind-carrier-nat.md) | No port can be forwarded, so no HTTP challenge and no dyndns. What works: a DNS-validated certificate, a local resolver, and one origin for app and APIs. |
| [Pi-hole as the LAN resolver](pi-hole-as-lan-dns.md) | Binding beside a NAS's own dnsmasq, forwarding the router's names back to it, local records in v6, and the v5 to v6 upgrade. |
| [QNAP notes](qnap-notes.md) | Which Apache files survive a restart, how to call QTS from a logged-in session, the Let's Encrypt wrapper that loses certificates, and the ACME client inside it that works. |
| [FRITZ!Box notes](fritzbox-notes.md) | No shell, an API without the one setting needed, a UI built from closed shadow roots, and a second factor for anything that matters. |
| [Working with an agent on infrastructure](working-with-an-agent.md) | Shared browser sessions, real clicks versus scripted ones, checking from where the user stands, and not trusting a success message. |
