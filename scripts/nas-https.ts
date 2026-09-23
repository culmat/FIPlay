/**
 * Serve FIPlay over HTTPS on the NAS, with the speaker API on the same origin.
 *
 * Usage: bun run nas:https [--check] [--force]
 *
 * Why this exists. A phone only installs a web app, rather than bookmarking it,
 * when the site is served over HTTPS and registers a service worker. FIPlay has
 * the worker; the NAS serves plain HTTP, so the app opens in a browser tab with
 * the address bar showing. And an HTTPS page may not call an http:// address,
 * so simply adding TLS would cut the app off from PyRaumfeld. Both halves are
 * solved by one Apache virtual host: TLS for the app, and a proxy that puts the
 * API on a path of that same origin, which also disposes of CORS.
 *
 * What it changes on the NAS:
 *   - writes /etc/config/apache/extra/httpd-fiplay-ssl.conf (owned by us)
 *   - adds one Include line to /etc/config/apache/extra/apache-common.conf
 *   - reloads the web server, after apachectl accepts the configuration
 *
 * A firmware update rewrites QNAP's own Apache files and drops the Include,
 * which is how the previous HTTPS site on this NAS went quiet. That is why this
 * is a re-runnable command rather than a one-off edit: run it again afterwards.
 *
 * Environment (.env):
 *   FIPLAY_NAS_HTTPS_HOST   hostname the phone will use, and the ServerName
 *   FIPLAY_NAS_HTTPS_PORT   port for the TLS vhost (default 4433)
 *   FIPLAY_NAS_CERT         certificate, key may be in the same file
 *                           (default /etc/stunnel/stunnel.pem)
 *   FIPLAY_NAS_CERT_CHAIN   intermediate chain (default /etc/stunnel/uca.pem,
 *                           skipped when absent)
 *   FIPLAY_BACKEND_PATH     path the API is proxied on (default /pyraumfeld/)
 *   FIPLAY_BACKEND_PORT     port PyRaumfeld listens on (default 8081)
 */
import { ENV, abort, backendCfg, envOr, gap, gaps, info, metadataProxyCfg, ok, phase, requireEnv, requireSsh, shq, skip, ssh, summary } from './lib';

const CONF = '/etc/config/apache/extra/httpd-fiplay-ssl.conf';

// apache.conf, and not one of the files in extra/, because QNAP rewrites those
// from its own settings on every web server restart: an Include added to
// apache-common.conf is gone by the time the server comes back up. apache.conf
// survives a restart. A firmware update is a different matter, which is what
// makes this command worth re-running rather than a one-time edit.
const INCLUDE_IN = '/etc/config/apache/apache.conf';
const APACHECTL = '/usr/local/apache/bin/apachectl';
const WEB_ROOT = '/share/Web';

/**
 * Does `file` on the NAS contain `needle`?
 *
 * Deliberately yes/no rather than a count: `grep -c` prints 0 *and* exits
 * non-zero when nothing matches, so the usual `|| echo 0` fallback appends a
 * second 0 and every "is it there" test silently answers yes.
 */
async function fileContains (needle: string, file: string): Promise<boolean> {
  const res = await ssh(`grep -qF ${shq(needle)} ${shq(file)} 2>/dev/null && echo yes || echo no`);
  return res.stdout.trim() === 'yes';
}

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const FORCE = args.has('--force');
for (const a of args) {
  if (!['--check', '--force'].includes(a)) abort(`unknown option ${a}\nusage: bun run nas:https [--check] [--force]`);
}

const cfg = requireEnv(ENV.NAS_HTTPS_HOST);
const serverName = cfg[ENV.NAS_HTTPS_HOST];
const port = envOr(ENV.NAS_HTTPS_PORT, '4433');
const cert = envOr(ENV.NAS_CERT, '/etc/stunnel/stunnel.pem');
const chain = envOr(ENV.NAS_CERT_CHAIN, '/etc/stunnel/uca.pem');
const backendPath = (backendCfg().path ?? '/pyraumfeld/').replace(/\/*$/, '/');
const backendPort = backendCfg().port;
const metadata = metadataProxyCfg();

if (!backendPath.startsWith('/')) abort(`${ENV.BACKEND_PATH} must start with a slash, got ${backendPath}`);

// --- Phase 1 -----------------------------------------------------------------
phase('Phase 1: Preflight');
const { target } = await requireSsh();
ok(`ssh ${target}`);

const certInfo = await ssh(`[ -f ${shq(cert)} ] && openssl x509 -in ${shq(cert)} -noout -subject -enddate -checkend 0; echo "exit:$?"`);
if (!certInfo.stdout.includes('subject')) abort(`no certificate at ${cert} on the NAS (set ${ENV.NAS_CERT})`);

const expired = certInfo.stdout.includes('exit:1');
const notAfter = /notAfter=(.*)/.exec(certInfo.stdout)?.[1]?.trim() ?? 'unknown';
const subject = /subject=\s*(.*)/.exec(certInfo.stdout)?.[1]?.trim() ?? 'unknown';
if (expired) {
  gap('GAP', `certificate expired on ${notAfter} (${subject})`);
  info('A browser refuses an expired certificate, which means no service worker,');
  info('no install, and a warning page instead of the app. Renew it first:');
  info('  QTS > Control Panel > Security > SSL Certificate & Private Key > Replace');
  info(`  or install a new PEM (certificate + key) at ${cert}`);
  if (!FORCE && !CHECK_ONLY) abort('refusing to publish HTTPS with an expired certificate (pass --force to set it up anyway)');
} else {
  ok(`certificate ${subject}, valid until ${notAfter}`);
}

const nameMatches = subject.includes(serverName);
if (!nameMatches) gap('GAP', `certificate is not for ${serverName}; the phone will warn unless the name matches`);

const modules = await ssh('ls /usr/local/apache/modules/ | grep -E "^mod_(ssl|proxy|proxy_http)\\.so$" | tr "\\n" " "');
for (const m of ['mod_ssl.so', 'mod_proxy.so', 'mod_proxy_http.so']) {
  if (!modules.stdout.includes(m)) abort(`${m} is missing from the NAS Apache; this configuration needs it`);
}
ok('mod_ssl, mod_proxy and mod_proxy_http present');

const listening = await ssh(`netstat -tln 2>/dev/null | grep -c ":${port} "`);
const portTaken = Number(listening.stdout.trim() || '0') > 0;
const ours = await fileContains(`Listen ${port}`, CONF);
if (portTaken && !ours) abort(`something already listens on port ${port}; pick another with ${ENV.NAS_HTTPS_PORT}`);
ok(portTaken ? `port ${port} already served by this configuration` : `port ${port} free`);

const backendUp = await ssh(`curl -s -o /dev/null -m 5 -w "%{http_code}" http://127.0.0.1:${backendPort}/zones`);
if (backendUp.stdout.startsWith('2')) ok(`PyRaumfeld answers on 127.0.0.1:${backendPort}`);
else gap('GAP', `PyRaumfeld did not answer on 127.0.0.1:${backendPort} (got ${backendUp.stdout || 'nothing'})`);

if (metadata) {
  const metaUp = await ssh(`curl -s -o /dev/null -m 8 -w "%{http_code}" http://127.0.0.1:${metadata.port}/api/metadata/fip`);
  if (metaUp.stdout.startsWith('2')) ok(`metadata service answers on 127.0.0.1:${metadata.port}`);
  else gap('GAP', `metadata service did not answer on 127.0.0.1:${metadata.port} (got ${metaUp.stdout || 'nothing'})`);
} else {
  info(`${ENV.METADATA_PORT} not set: the app will fetch metadata from ${ENV.METADATA_URL} directly, which https blocks if that is http://`);
}

if (CHECK_ONLY) {
  const installed = await fileContains(CONF, INCLUDE_IN);
  info(installed ? 'the Include is in place' : 'the Include is NOT in place; run without --check to install it');
  summary(gaps() > 0 ? `${gaps()} thing(s) to sort out before HTTPS will work` : 'ready to install');
  process.exit(0);
}

// --- Phase 2 -----------------------------------------------------------------
phase('Phase 2: Write the virtual host');

const chainPresent = (await ssh(`[ -f ${shq(chain)} ] && echo yes || echo no`)).stdout.trim() === 'yes';
if (!chainPresent) skip(`no chain file at ${chain}; serving the certificate alone`);

const conf = `# Managed by FIPlay: bun run nas:https. Edits here are overwritten.
#
# A firmware update rewrites QNAP's Apache files and drops the Include that
# pulls this in. Re-run the command to put it back.

<IfModule !ssl_module>
LoadModule ssl_module modules/mod_ssl.so
</IfModule>
<IfModule !proxy_module>
LoadModule proxy_module modules/mod_proxy.so
</IfModule>
<IfModule !proxy_http_module>
LoadModule proxy_http_module modules/mod_proxy_http.so
</IfModule>

SSLRandomSeed startup file:/dev/urandom 512
SSLRandomSeed connect builtin

Listen ${port}

<VirtualHost *:${port}>
  ServerName ${serverName}
  DocumentRoot "${WEB_ROOT}"

  SSLEngine on
  SSLCertificateFile "${cert}"
${chainPresent ? `  SSLCertificateChainFile "${chain}"\n` : ''}  SSLProtocol -all +TLSv1.2 +TLSv1.3
  SSLHonorCipherOrder off

  # The app's own .htaccess handles SPA routing and cache headers, and the
  # server-wide <Directory "${WEB_ROOT}"> already allows it to.
</VirtualHost>

# PyRaumfeld on the web server's own origin, so an HTTPS page can call it at
# all: a page served over TLS may not request an http:// address, and same
# origin means no CORS either. FIPlay is pointed at it with
# ?backend=${backendPath}
#
# Deliberately at server level rather than inside the vhost above, so the path
# answers on plain HTTP as well. One manifest then works whether the app was
# opened over http or https, and the setup can be tested before a certificate
# is in place.
ProxyPreserveHost Off
ProxyPass ${backendPath} http://127.0.0.1:${backendPort}/
ProxyPassReverse ${backendPath} http://127.0.0.1:${backendPort}/
${metadata ? `
# The now-playing metadata service, when it runs on this NAS, for the same
# reason. The app is built with VITE_METADATA_URL=${metadata.path.replace(/\/$/, '')}
ProxyPass ${metadata.path} http://127.0.0.1:${metadata.port}/
ProxyPassReverse ${metadata.path} http://127.0.0.1:${metadata.port}/
` : ''}`;

const encoded = Buffer.from(conf, 'utf8').toString('base64');
const write = await ssh(`echo ${shq(encoded)} | openssl base64 -d -A > ${shq(CONF)} && chmod 644 ${shq(CONF)} && echo written`);
if (!write.stdout.includes('written')) abort(`could not write ${CONF}: ${write.stderr || write.stdout}`);
ok(`wrote ${CONF}`);

const includeLine = `Include ${CONF}`;
const already = await fileContains(includeLine, INCLUDE_IN);
if (already) {
  skip(`${INCLUDE_IN} already includes it`);
} else {
  const backup = `${INCLUDE_IN}.fiplay-backup`;
  await ssh(`[ -f ${shq(backup)} ] || cp ${shq(INCLUDE_IN)} ${shq(backup)}`);
  const appended = await ssh(`printf '\\n# FIPlay HTTPS, see bun run nas:https\\n%s\\n' ${shq(includeLine)} >> ${shq(INCLUDE_IN)} && echo appended`);
  if (!appended.stdout.includes('appended')) abort(`could not add the Include to ${INCLUDE_IN}`);
  ok(`added the Include to ${INCLUDE_IN} (backup at ${backup})`);
}

// --- Phase 3 -----------------------------------------------------------------
phase('Phase 3: Apply');
const test = await ssh(`${APACHECTL} -t 2>&1`);
if (!test.stdout.includes('Syntax OK')) {
  // Leave the server running on the configuration it already had.
  await ssh(`sed -i ${shq(`\\#${includeLine}#d`)} ${shq(INCLUDE_IN)}`);
  abort(`Apache rejected the configuration, so nothing was applied:\n${test.stdout}`);
}
ok('apachectl reports Syntax OK');

const restart = await ssh('/etc/init.d/Qthttpd.sh restart 2>&1; sleep 3; echo done');
if (!restart.stdout.includes('done')) abort('the web server did not come back');
ok('web server reloaded');

// --- Phase 4 -----------------------------------------------------------------
phase('Phase 4: Verify');
const appStatus = await ssh(`curl -s -k -o /dev/null -m 10 -w "%{http_code}" https://127.0.0.1:${port}/FIPlay/`);
if (appStatus.stdout !== '200') abort(`the app answered ${appStatus.stdout || 'nothing'} over TLS on port ${port}`);
ok(`https://…:${port}/FIPlay/ -> 200`);

const apiStatus = await ssh(`curl -s -k -o /dev/null -m 15 -w "%{http_code}" https://127.0.0.1:${port}${backendPath}zones`);
if (apiStatus.stdout.startsWith('2')) ok(`https://…:${port}${backendPath}zones -> ${apiStatus.stdout}`);
else gap('GAP', `the proxied API answered ${apiStatus.stdout || 'nothing'}`);

if (metadata) {
  const metaStatus = await ssh(`curl -s -k -o /dev/null -m 15 -w "%{http_code}" https://127.0.0.1:${port}${metadata.path}api/metadata/fip`);
  if (metaStatus.stdout.startsWith('2')) ok(`https://…:${port}${metadata.path}api/metadata/fip -> ${metaStatus.stdout}`);
  else gap('GAP', `the proxied metadata service answered ${metaStatus.stdout || 'nothing'}`);
}

// Everything above was checked from the NAS itself, which proves the server is
// right and nothing about whether a phone on the sofa can reach it. The name on
// the certificate usually points at the public address, and a home router will
// not always route back in from the inside, so check from here too.
const url = `https://${serverName}:${port}/FIPlay/`;
// Routing only: the certificate is judged in the preflight, and an expired or
// mismatched one must not make a working route read as a dead one.
const fromHere = await (async () => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'manual', tls: { rejectUnauthorized: false } } as RequestInit);
    return res.status;
  } catch {
    return null;
  }
})();
if (fromHere === null) {
  gap('GAP', `${serverName}:${port} does not answer from this machine`);
  info('The NAS is serving; the address just does not lead back to it from inside');
  info('the network. Either forward the port on the router and let it route back');
  info('in, or resolve this name to the LAN address of the NAS at home.');
} else {
  ok(`${serverName}:${port} reachable from this machine (${fromHere})`);
}

if (expired) info('the certificate is still expired, so a browser will refuse this address');
summary(gaps() > 0 ? `HTTPS is configured at ${url}, with ${gaps()} thing(s) left` : `HTTPS ready at ${url}`);
if (gaps() === 0) {
  info(`Open it on the phone, then use the browser menu to install it.`);
  info(`Run bun run deploy afterwards so the manifest starts at ?backend=${backendPath}`);
}
