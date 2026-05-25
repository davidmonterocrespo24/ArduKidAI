#!/usr/bin/env bash
# Pull latest, rebuild containers, install playwright + system deps so the
# AI assistant can take screenshots without bothering the operator again.
#
# Usage:
#   sudo bash /home/dave/ArduKidAI/deploy/redeploy.sh
#
# Idempotent. Logs to /tmp/ardukid-redeploy.log so the assistant can read it.

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
    echo "must run as root (use sudo)" >&2
    exit 1
fi

APP_DIR="/home/dave/ArduKidAI"
LOG="/tmp/ardukid-redeploy.log"

cd "${APP_DIR}"

echo "[1/5] git pull on $(date -Iseconds)" | tee "${LOG}"
sudo -u dave git pull --ff-only origin main 2>&1 | tee -a "${LOG}"

echo "" | tee -a "${LOG}"
echo "[2/5] docker compose up -d --build" | tee -a "${LOG}"
docker compose up -d --build 2>&1 | tee -a "${LOG}"

echo "" | tee -a "${LOG}"
echo "[3/5] waiting for /health" | tee -a "${LOG}"
for attempt in $(seq 1 15); do
    if curl -fsS --max-time 2 http://127.0.0.1:8080/health > /dev/null 2>&1; then
        echo "backend ready (attempt ${attempt})" | tee -a "${LOG}"
        break
    fi
    sleep 2
    if [ "${attempt}" = "15" ]; then
        echo "backend did not come up; tail container log:" | tee -a "${LOG}"
        docker compose logs --tail=40 backend | tee -a "${LOG}"
        exit 2
    fi
done

echo "" | tee -a "${LOG}"
echo "[4/5] verify public bundle hash" | tee -a "${LOG}"
sleep 1
LOCAL_HTML=$(curl -fsS --max-time 5 http://127.0.0.1:8081/ || true)
PUBLIC_HTML=$(curl -fsS --max-time 5 https://ArduKidAI.moontero.com/ || true)
LOCAL_BUNDLE=$(echo "${LOCAL_HTML}" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
PUBLIC_BUNDLE=$(echo "${PUBLIC_HTML}" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
echo "container bundle: ${LOCAL_BUNDLE}" | tee -a "${LOG}"
echo "public bundle:    ${PUBLIC_BUNDLE}" | tee -a "${LOG}"
if [ -n "${LOCAL_BUNDLE}" ] && [ "${LOCAL_BUNDLE}" = "${PUBLIC_BUNDLE}" ]; then
    echo "OK: public is serving the freshly built bundle" | tee -a "${LOG}"
else
    echo "WARN: public bundle does not match container; check nginx cache / reload" | tee -a "${LOG}"
fi

echo "" | tee -a "${LOG}"
echo "[5/5] playwright + system deps (so the assistant can screenshot)" | tee -a "${LOG}"
if [ ! -d /home/dave/.cache/ms-playwright ]; then
    sudo -u dave bash -c "export PATH=\"\$HOME/.nvm/versions/node/v24.16.0/bin:\$PATH\" && npx --yes playwright@latest install chromium" 2>&1 | tee -a "${LOG}"
fi
# Install system libs for chromium-headless. `playwright install-deps` is the
# idiomatic way - it runs apt-get under the hood for the right package set.
sudo -u dave bash -c "export PATH=\"\$HOME/.nvm/versions/node/v24.16.0/bin:\$PATH\" && npx --yes playwright@latest install-deps chromium" 2>&1 | tee -a "${LOG}"

echo "" | tee -a "${LOG}"
echo "done. Log saved to ${LOG}" | tee -a "${LOG}"
echo "open: https://ArduKidAI.moontero.com" | tee -a "${LOG}"
