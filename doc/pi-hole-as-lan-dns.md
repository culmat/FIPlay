# Pi-hole as the LAN resolver, on a NAS

## The problem

A Pi-hole container on a QNAP NAS was running but answered nothing, and had for a long time:
it was attached to no Docker network and the router still handed out itself as DNS. It was
needed for one local DNS record.

## What turned out to be true

- **Port 53 on the NAS is partly taken.** QTS runs its own `dnsmasq` bound to loopback and
  to the Container Station bridge gateways. A container publishing `0.0.0.0:53` fails to
  start with "address already in use" although nothing listens on the LAN address. Publish
  on the LAN address only: `-p <nas-lan-ip>:53:53/tcp -p <nas-lan-ip>:53:53/udp`.
- **Pi-hole does not know the router's device names.** Once clients ask Pi-hole, `<nas>` and
  `<nas>.fritz.box` stop resolving, and with them every tool that uses the bare name, including
  an app whose metadata service was configured as `http://<nas>:8082`. Fix: forward the router's
  zone and reverse lookups to the router, and forward unqualified names as well:

  ```
  pihole-FTL --config dns.revServers '["true,<lan-subnet>/24,<router-ip>,fritz.box"]'
  pihole-FTL --config misc.dnsmasq_lines '["server=//<router-ip>"]'
  pihole restartdns
  ```

  `server=//<ip>` is dnsmasq's rule for names without a dot. It is what makes plain `<nas>`
  work from a client that appends no search domain (Android, for instance).
- **Local records in v6** are one command, applied live:

  ```
  pihole-FTL --config dns.hosts '["<nas-lan-ip> <device>.<vendor>.com"]'
  ```

- **v5 to v6** on Docker: the config migrates itself on first start. Environment changes
  worth knowing: `WEBPASSWORD` became `FTLCONF_webserver_api_password`; set
  `FTLCONF_dns_listeningMode=all` in bridge mode; `FTLCONF_LOCAL_IPV4`, `DNSMASQ_USER`,
  `VIRTUAL_HOST` and `PROXY_LOCATION` are gone. Keep the two bind mounts (`/etc/pihole`,
  `/etc/dnsmasq.d`) and the container's own `--dns` upstreams. Back up the two directories
  first; it is one `tar`.
- **The switch on the router is the moment of truth.** From then on the NAS is the resolver
  for the whole home, and name resolution at home is down when the NAS is. Verify Pi-hole
  answers from a client (`dig @<nas-lan-ip> example.com`, an ad domain returning `0.0.0.0`,
  the local record, `<nas>` and `<nas>.fritz.box`) *before* pointing the router at it.

## Passing a secret into a container without echoing it

The web password must not appear on a command line (it lands in process lists and shell
history) nor in a tool's output. Send it over the SSH channel on stdin into a root-only env
file, then use `--env-file`:

```
printf 'FTLCONF_webserver_api_password=%s\n' "$PW" | ssh <nas> 'umask 077; cat > /share/pihole/pihole.env'
docker run ... --env-file /share/pihole/pihole.env ...
```
