# FRITZ!Box (FRITZ!OS 8) notes

## Ways in, and which work

| method | verdict |
| --- | --- |
| SSH or telnet | none exists on FRITZ!OS, any model |
| TR-064 (what `fritzconnection`, `fritzctl` and similar tools use) | fine for Wi-Fi, DHCP range, port sharing, DECT, smart home. The LAN service offers `GetDNSServers` but **no setter**: the "local DNS server" setting is not exposed. Check `http://fritz.box:49000/lanhostconfigmgmSCPD.xml` for the action list before assuming |
| the web UI, automated | yes, with caveats below |
| the web UI, by hand | for one field, fastest |

## Automating the web UI

- The page content is built from custom elements with **closed shadow roots**. Neither
  `document.querySelector` nor Playwright's shadow-piercing locators reach the form fields
  and buttons; text searches return nothing for labels that are plainly on screen. A tab
  link may resolve but report itself invisible.
- What works: take a screenshot, compute coordinates (device pixels divided by
  `devicePixelRatio`, minus the scroll offset), and click and type at those positions.
  Segmented IP fields accept a click on the last octet, select-all, type, Tab.
- Apply lives in a sticky bar at the bottom of the viewport. Reloading the route with a
  pending change raises a "save the changes?" dialog; do not hit Discard.
- Changing anything under "Advanced Network Settings" needs a **second factor**: a code
  from the authenticator app, a connected phone, or a physical press on the box. Only the
  owner can complete it. Plan for a hand-over at that point.

## The one setting needed for a local resolver

Home Network → Network → Network Settings → "Change Advanced Network Settings" → IPv4 →
"Local DNS server". The box announces that address to all DHCP clients; devices switch on
their next lease renewal (toggle Wi-Fi to hurry one along). From then on the router is out of
the DNS path, which also sidesteps its DNS rebind protection.

## Reachability from inside

A forwarded port is not reachable from the LAN via the public address on this box, and behind
a mobile carrier's NAT there is no reachable public address anyway. Do not plan on hairpin.
