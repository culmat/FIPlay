#!/bin/sh
# Renew the Let's Encrypt certificate for a myQNAPcloud name, on the NAS itself.
#
# Usage: renew-cert.sh <domain> <email> [days]
#   Renews when the installed certificate has fewer than <days> (default 30)
#   left, or is for a different name. Meant for QNAP's crontab, monthly.
#
# Why this exists. QTS ships a Let's Encrypt agent that can validate a
# myQNAPcloud name over DNS (no inbound port needed, which is what a carrier-NAT
# connection requires). Its wrapper, however, lost the issued certificate in
# post-processing and reported success anyway. The Python ACME client inside it
# works on its own, and its DNS hook publishes the challenge through QNAP's API,
# so this script drives that client directly and installs the result where the
# web server and the FIPlay vhost read it: /etc/stunnel/stunnel.pem (key +
# certificate) and /etc/stunnel/uca.pem (chain).
#
# Installed by hand on 2026-09-23 next to the certificate files in
# /share/fiplay-cert; see the README section on `bun run nas:https`.
set -e
export PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin

DOMAIN="$1"; EMAIL="$2"; DAYS="${3:-30}"
[ -n "$DOMAIN" ] && [ -n "$EMAIL" ] || { echo "usage: $0 <domain> <email> [days]"; exit 2; }

QPKG=/mnt/ext/opt/QcloudSSLCertificate
PY=/mnt/ext/opt/Python/bin/python2.7
OUT=/share/fiplay-cert
SYS=/etc/stunnel
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Nothing to do while the current certificate is for this name and not close to expiry.
if openssl x509 -in $SYS/stunnel.pem -noout -subject 2>/dev/null | grep -q "CN *= *$DOMAIN" \
   && openssl x509 -in $SYS/stunnel.pem -noout -checkend $((DAYS * 86400)) >/dev/null 2>&1; then
  log "certificate for $DOMAIN still valid for more than $DAYS days; nothing to do"
  exit 0
fi

log "renewing $DOMAIN"
mkdir -p "$OUT" && chmod 700 "$OUT"

# Account key and CSR the way QTS makes them (account key is kept if present).
sh $QPKG/bin/generate_letsencrypt_csr.sh 0 "$DOMAIN" "$EMAIL" dns /Web >/dev/null 2>&1 || true
rm -f $QPKG/data/downloading
[ -s $QPKG/cert/csr ] && [ -s $QPKG/cert/key ] || { log "CSR generation failed"; exit 1; }
cp $QPKG/cert/key $OUT/key.new && chmod 600 $OUT/key.new

# The ACME client, DNS challenge, all output kept.
if ! $PY $QPKG/bin/acme-tiny/acme_tiny.py \
    --account-key $QPKG/cert/account/key --csr $QPKG/cert/csr \
    --acme-dir $QPKG/cert/.well-known/acme-challenge --qpkg-dir $QPKG \
    --well-known-dir $QPKG/cert/.well-known --contact "$EMAIL" \
    --cert-file $OUT/cert.new --chain-file $OUT/chain.new \
    --verify_type dns --web-document-root /Web > /dev/null 2> $OUT/acme.log; then
  log "ACME client failed; see $OUT/acme.log"; exit 1
fi

# Belt and braces before touching the system files.
kmod=$(openssl rsa -in $OUT/key.new -noout -modulus | md5sum | cut -d' ' -f1)
cmod=$(openssl x509 -in $OUT/cert.new -noout -modulus | md5sum | cut -d' ' -f1)
[ "$kmod" = "$cmod" ] || { log "key does not match certificate; aborting"; exit 1; }
openssl verify -CAfile $OUT/chain.new $OUT/cert.new >/dev/null 2>&1 || { log "chain does not verify; aborting"; exit 1; }

# Install, keeping what was there.
B=$SYS/backup-$(date +%Y%m%d-%H%M); mkdir -p "$B"; cp -p $SYS/stunnel.pem $SYS/uca.pem $SYS/backup.cert $SYS/backup.key "$B"/ 2>/dev/null || true
umask 077
cat $OUT/key.new $OUT/cert.new > $SYS/stunnel.pem.new && mv $SYS/stunnel.pem.new $SYS/stunnel.pem
cp $OUT/chain.new $SYS/uca.pem; cp $OUT/cert.new $SYS/backup.cert; cp $OUT/key.new $SYS/backup.key
mv $OUT/cert.new $OUT/cert.pem; mv $OUT/chain.new $OUT/chain.pem; mv $OUT/key.new $OUT/key.pem
chmod 600 $SYS/stunnel.pem $SYS/uca.pem $SYS/backup.cert $SYS/backup.key $OUT/key.pem

# The Web Server (Apache, and with it the FIPlay vhost) reads the files at start.
/etc/init.d/Qthttpd.sh restart >/dev/null 2>&1 || true
log "installed: $(openssl x509 -in $SYS/stunnel.pem -noout -enddate)"
