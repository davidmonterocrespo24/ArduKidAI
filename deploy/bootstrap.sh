#!/usr/bin/env bash
# One-shot dev deploy: builds the containers, installs the nginx site, and
# optionally issues a Let's Encrypt cert.
#
# Usage:
#   sudo bash deploy/bootstrap.sh <domain> [email]
#
# Examples:
#   sudo bash deploy/bootstrap.sh ArduKidAI.moontero.com you@example.com
#   sudo bash deploy/bootstrap.sh ArduKidAI.moontero.com         # HTTP only; run certbot later
#
# Idempotent: re-running rebuilds the containers and overwrites the nginx site.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
    echo "usage: sudo bash deploy/bootstrap.sh <domain> [email]" >&2
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
    echo "must run as root (use sudo)" >&2
    exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_NAME="ardukidai"
SITE_AVAIL="/etc/nginx/sites-available/${SITE_NAME}"
SITE_LINK="/etc/nginx/sites-enabled/${SITE_NAME}"

if [ ! -f "${APP_DIR}/.env" ]; then
    echo "missing ${APP_DIR}/.env - copy .env.example and set JWT_SECRET first" >&2
    exit 1
fi

echo ">>> [1/5] docker compose build + up in ${APP_DIR}"
cd "${APP_DIR}"
docker compose up -d --build

echo ">>> [2/5] wait for backend /health"
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -fsS --max-time 2 http://127.0.0.1:8080/health > /dev/null 2>&1; then
        echo "backend reachable"
        break
    fi
    sleep 2
    if [ "${attempt}" = "12" ]; then
        echo "backend did not come up; check 'docker compose logs backend'" >&2
        exit 2
    fi
done

echo ">>> [3/5] write nginx site for ${DOMAIN}"
cat > "${SITE_AVAIL}" <<NGINX
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

upstream ardukid_backend  { server 127.0.0.1:8080; }
upstream ardukid_frontend { server 127.0.0.1:8081; }

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # The avr8js + Blockly bundle is fine over default sizes, but the SSE
    # chat stream needs proxy timeouts >= the slowest tool round trip.
    proxy_read_timeout    300s;
    proxy_send_timeout    300s;
    client_max_body_size  16M;

    location /api/ {
        proxy_pass http://ardukid_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        \$connection_upgrade;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_buffering off;
        proxy_cache off;
    }

    location = /health {
        proxy_pass http://ardukid_backend/health;
        access_log off;
    }

    location / {
        proxy_pass http://ardukid_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf "${SITE_AVAIL}" "${SITE_LINK}"
nginx -t
systemctl reload nginx

echo ">>> [4/5] HTTP smoke test"
sleep 1
curl -fsS --max-time 5 "http://${DOMAIN}/health" || {
    echo "HTTP health failed; check DNS and that ${DOMAIN} resolves to this host" >&2
    exit 3
}
echo ""

if [ -n "${EMAIL}" ]; then
    echo ">>> [5/5] certbot --nginx -d ${DOMAIN} -m ${EMAIL}"
    certbot --nginx -d "${DOMAIN}" -m "${EMAIL}" --agree-tos --redirect --non-interactive
    echo ""
    echo "HTTPS: https://${DOMAIN}"
    curl -fsSI --max-time 5 "https://${DOMAIN}/health" | head -3 || true
else
    echo ">>> [5/5] skipped TLS"
    echo "to add HTTPS later, run:"
    echo "  sudo certbot --nginx -d ${DOMAIN} -m you@example.com --agree-tos --redirect"
fi

echo ""
echo "done. Site is at:"
if [ -n "${EMAIL}" ]; then
    echo "  https://${DOMAIN}"
else
    echo "  http://${DOMAIN}"
fi
echo "tail logs with: docker compose logs -f"
