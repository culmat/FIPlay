# HTTPS for a home service behind carrier NAT

## The problem

A service on a NAS at home should be reachable over HTTPS from a phone on the same Wi-Fi, with
a certificate the phone trusts. The home internet connection is a mobile (5G) router.

## What turned out to be true

**Carrier-grade NAT means no inbound connection at all.** The address the router reports as
public belongs to the carrier's NAT pool. An external port checker shows every port closed,
whatever is forwarded on the router. Everything that assumes inbound reachability is a dead
end: port forwarding, dynamic DNS pointing at the "public" address, Let's Encrypt's HTTP-01
challenge, and hairpin access from the LAN via the public name. A dyndns name that used to
work on DSL keeps pointing at the old address, and a certificate that used to renew over port
80 silently stops the day the connection changes.

Check for it before planning anything: `curl https://ifconfig.co/port/80` (and 443) from
inside the network, and `whois` on the public address. A mobile carrier's netname settles it.

**Two independent problems hide in "HTTPS at home".**

1. A certificate the phone trusts, for some name.
2. That name resolving to the NAS's LAN address while at home.

Solutions that solve one and not the other look complete from the NAS itself. Test from a
client machine, not from the server's loopback.

## Options, and where each falls short

| route | certificate | LAN resolution | notes |
| --- | --- | --- | --- |
| Let's Encrypt via HTTP-01 for a dyndns name | impossible behind carrier NAT | no | the classic setup; dies with the DSL line |
| Let's Encrypt via **DNS-01** for a vendor DDNS name (here: QNAP's myQNAPcloud) | yes, no inbound port needed | no, name resolves to the carrier address | vendor DNS zone, vendor API places the TXT record |
| a local CA (mkcert) for a LAN name | yes, after installing the root on each device | yes, the router already resolves it | Firefox on Android needs a hidden setting to trust user CAs |
| Tailscale or similar | yes, automatic | yes, and away from home too | the phone must run the VPN client |
| the vendor's cloud relay | vendor's certificate on the vendor's proxy | n/a | carries only the vendor's own services, not a custom port |

The route taken here: DNS-validated certificate for the vendor DDNS name, plus a local
resolver that answers that name with the LAN address. Home-only is a feature when the service
has no authentication of its own.

## The design that works

```
phone ──DNS──▶ Pi-hole (on the NAS): <device>.<vendor>.com → <nas-lan-ip>
phone ──HTTPS:4433──▶ Apache vhost on the NAS
                      ├── /            static app
                      ├── /pyraumfeld/ → 127.0.0.1:8081  (speaker API)
                      └── /metadata/   → 127.0.0.1:8082  (metadata service)
```

- **One origin for everything.** The reverse-proxy paths put every service on the app's
  HTTPS origin, which is the only way an HTTPS page may reach them (mixed content), and
  removes CORS as a topic. Configure the proxy paths at server level, not inside the TLS
  vhost, so they answer over plain HTTP too: one build of the app works on both, and the
  setup can be tested before a certificate exists.
- **Build the app against the paths, not absolute addresses.** A same-origin path such as
  `/metadata` works over http and https alike. Keep the absolute address in the env file for
  tooling that talks to the service directly.
- **Local resolver.** Any resolver the router hands out to clients that is not the router
  itself must forward the router's own zone (`fritz.box`, reverse lookups) and unqualified
  names back to the router, or every device name on the network stops resolving the moment
  clients switch. See the Pi-hole note.
- **Certificate renewal must run on the NAS on a schedule.** A 90-day certificate with a
  manual renewal is a scheduled outage.

## Two traps met on the way

- **macOS caches negative DNS answers.** After switching resolvers, `dig` shows the right
  answer while `ssh <name>` still fails for several minutes. Neither `dscacheutil
  -flushcache` alone nor waiting a few seconds helps. Use the address meanwhile.
- **A TLS-validating check reports a good route as dead** while the certificate is still
  the old one. Test routing with certificate validation off and the certificate separately,
  or an honest "reachable" check turns into a false alarm during exactly the phase where it
  is needed.
