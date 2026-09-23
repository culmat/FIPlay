# QNAP (QTS 5.2) notes

Everything below was learned on a TS-x53 class NAS running QTS 5.2. Paths are QTS's.

## Apache: which files survive

- `/etc/config/apache/extra/*.conf` is **regenerated from QTS's settings on every web server
  restart** (`/etc/init.d/Qthttpd.sh restart`). An `Include` added there is gone before the
  server comes back. This is the likeliest reason a hand-made HTTPS site on a QNAP goes quiet
  by itself one day.
- `/etc/config/apache/apache.conf` survives a restart. It has `.bak` and `.orig` siblings,
  which suggests firmware updates rewrite it. Anything added there should be re-applicable
  by a command, not a one-time edit.
- The user vhost files QNAP ships (`httpd-vhosts-user.conf`, `httpd-ssl-vhosts-user.conf`)
  are not included by anything unless a QTS setting includes them. Do not assume they are.
- `mod_ssl`, `mod_proxy` and `mod_proxy_http` are on disk but not loaded by default. Load them
  inside `<IfModule !...>` guards in your own file so a later QTS setting that loads them too
  does not produce a duplicate-module error.
- QTS's own HTTPS vhost for the Web Server (`apache-ssl.conf`) listens on port 8081 when
  enabled. If something else uses 8081, enabling "secure connection" in the Web Server app
  will collide with it.
- `apachectl -t` works for a syntax check. The global `<Directory "/share/Web">` already has
  `AllowOverride All`, so an app's `.htaccess` keeps working under a new vhost with the same
  document root.

## Driving QTS without clicking

QTS's desktop is an ExtJS application that is painful to automate. Its backend, however, is
CGIs that a logged-in session can call directly.

- The session id is the `NAS_SID` cookie in the browser (also in `sessionStorage`). A page
  loaded from the NAS can call CGIs with `fetch` and pass `sid=` as a parameter.
- The newer apps talk to a proxy CGI with a method and a path:
  `POST /cgi-bin/qid/qidRequestV2.cgi?method=PUT&path=%2Fddns&sid=…` with a JSON body. The
  HTTP method is POST for anything but GET; the real method travels in the `method` parameter.
  The same shape exists for the certificate agent: `/cgi-bin/qpkg/QcloudSSLCertificate/ssl_agent_v2.cgi`
  with paths `/certificate`, `/certificate/download`, `/certificate/apply`.
- The older CGIs answer XML with a large boilerplate header (`<QDocRoot>`, model, firmware);
  the useful fields are at the end.
- The request shapes are in the apps' bundled JavaScript under `/mnt/ext/opt/<Package>/ui/`
  and `/home/httpd/cgi-bin/apps/`. They are minified into single huge lines; search them with
  bounded windows (`grep -oE ".{0,200}keyword.{0,200}"`), never dump them.
- Enabling myQNAPcloud DDNS is `PUT /ddns` with the full configuration object the app's
  toggle sends: `{enabled, enabledv6, mode: "auto", modev6: "auto", ipv4: "", ipv6: "",
  enabled_lan, lan_mode: "auto", lan_modev6: "auto"}`. The shell tool
  `/usr/local/bin/qcloud_ddns_tool set_ddns -t ipv4 -m auto` sets the mode but did not flip
  the enable switch here.

## The Let's Encrypt wrapper loses certificates

QTS ships a Let's Encrypt agent (`QcloudSSLCertificate`) that can validate a myQNAPcloud name
over **DNS**, publishing the challenge record through QNAP's API. Behind carrier NAT this is
the only challenge that can work, and it does: the record appears in public DNS, and the
client logs the domain as verified and the certificate as signed.

The C wrapper around it then logs `error in stage: -5001`, which is not an error but its
"stage finished" code, records the certificate with QNAP, posts a "Downloaded and installed
the certificate" notification, and leaves **no certificate anywhere on disk**, having also
removed the account key. Twice, identically. Its logs (`/etc/logs/QcloudSSLCertificate/log/
ssl_agent.log`, `acme_error_log_<type>`) contain nothing about why. Certificate transparency
(crt.sh) confirmed nothing was issued.

What works is the Python ACME client inside the package, run directly:

```
sh /mnt/ext/opt/QcloudSSLCertificate/bin/generate_letsencrypt_csr.sh 0 <domain> <email> dns /Web
/mnt/ext/opt/Python/bin/python2.7 /mnt/ext/opt/QcloudSSLCertificate/bin/acme-tiny/acme_tiny.py \
  --account-key .../cert/account/key --csr .../cert/csr --acme-dir .../cert/.well-known/acme-challenge \
  --qpkg-dir /mnt/ext/opt/QcloudSSLCertificate --well-known-dir .../cert/.well-known \
  --contact <email> --cert-file <out>/cert.pem --chain-file <out>/chain.pem --verify_type dns
```

The private key is `.../cert/key`. Copy it out immediately; the wrapper's cleanup deletes it.
Install as QTS lays it out: `/etc/stunnel/stunnel.pem` is key followed by certificate,
`/etc/stunnel/uca.pem` the chain, `backup.cert` and `backup.key` copies. Restart the Web
Server to load it. QNAP's own renewal will not run for a certificate obtained this way, so a
cron entry is needed; `scripts/nas/renew-cert.sh` in this repository does the whole thing and
is idle while the installed certificate is fine. Check for Let's Encrypt's issuance with
crt.sh after a suspicious "success".

Two more details: the non-interactive SSH shell's `PATH` lacks `/usr/local/bin`, so scripts
calling a bare `python` fail with "command not found" although `/usr/local/bin/python` exists
(set `PATH` at the top of anything run over SSH or from cron); and the myQNAPcloud relay
(`<device>.myqnapcloud.com` resolving to a QNAP address) carries only QNAP's own services,
not a custom port.

## Container Station

- `docker` lives at `/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker`, off the
  non-interactive `PATH`.
- A container can be "running" with `NetworkSettings.Networks` empty after a Container
  Station update; it then serves nothing while looking healthy. Recreating it is the fix.
- Cron: QNAP keeps the persistent crontab in `/etc/config/crontab`; edit it and load it with
  `crontab /etc/config/crontab`.
