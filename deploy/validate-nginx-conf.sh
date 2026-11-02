#!/usr/bin/env bash
# Валидация deploy/nginx.conf:
# 1. Проверка безопасности (proxy_pass только на разрешённый Supabase-хост, наличие обязательных security-заголовков).
# 2. Проверка синтаксиса (nginx -t) с моком SSL-сертификатов, если nginx установлен в системе.
set -euo pipefail

CONF_FILE="${1:-deploy/nginx.conf}"

if [ ! -f "$CONF_FILE" ]; then
    echo "ERROR: Конфигурационный файл $CONF_FILE не найден" >&2
    exit 1
fi

echo "==> [1/2] Проверка безопасности $CONF_FILE..."

# Проверяем, что proxy_pass ведёт только на ожидаемый Supabase-хост.
UNEXPECTED=$(grep -P 'proxy_pass\s+https?://' "$CONF_FILE" \
    | grep -v 'joaxeoavjvlqmtlepkrr\.supabase\.co' \
    | grep -v '\$sb_host' || true)
if [ -n "$UNEXPECTED" ]; then
    echo "ERROR: $CONF_FILE содержит неожиданный proxy_pass:" >&2
    echo "$UNEXPECTED" >&2
    exit 1
fi

# Убеждаемся, что $sb_host задан именно нашим Supabase-проектом.
if ! grep -q 'set \$sb_host joaxeoavjvlqmtlepkrr\.supabase\.co' "$CONF_FILE"; then
    echo "ERROR: \$sb_host не соответствует ожидаемому Supabase-хосту" >&2
    exit 1
fi

# Проверяем наличие обязательных security-заголовков.
for HEADER in "Strict-Transport-Security" "X-Frame-Options" "X-Content-Type-Options"; do
    if ! grep -q "$HEADER" "$CONF_FILE"; then
        echo "ERROR: $CONF_FILE не содержит заголовок $HEADER" >&2
        exit 1
    fi
done
echo "    Безопасность конфига: OK"

echo "==> [2/2] Проверка синтаксиса через nginx -t..."

if ! command -v nginx &>/dev/null; then
    if command -v apt-get &>/dev/null && [ "$(id -u)" -eq 0 ]; then
        echo "    Установка nginx в CI-окружении..."
        apt-get update -qq && apt-get install -y -qq nginx
    elif command -v sudo &>/dev/null && sudo -n true 2>/dev/null; then
        echo "    Установка nginx через sudo..."
        sudo apt-get update -qq && sudo apt-get install -y -qq nginx
    fi
fi

if command -v nginx &>/dev/null; then
    SSL_DIR="/etc/letsencrypt/live/avtorstudio.com"
    SUDO=""
    if [ "$(id -u)" -ne 0 ] && command -v sudo &>/dev/null; then
        SUDO="sudo"
    fi

    $SUDO mkdir -p "$SSL_DIR" /var/www/avtorstudio/dist
    if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
        $SUDO openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
            -keyout "$SSL_DIR/privkey.pem" \
            -out "$SSL_DIR/fullchain.pem" \
            -subj "/CN=avtorstudio.com" 2>/dev/null
    fi

    WORK="$(mktemp -d /tmp/nginx-test.XXXXXX)"
    trap 'rm -rf "$WORK"' EXIT

    ABS_CONF="$(cd "$(dirname "$CONF_FILE")" && pwd)/$(basename "$CONF_FILE")"

    cat > "$WORK/test-nginx.conf" << EOF
events {
    worker_connections 1024;
}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    include $ABS_CONF;
}
EOF

    $SUDO nginx -t -c "$WORK/test-nginx.conf"
    echo "    Синтаксис nginx: OK"
else
    echo "    warn: nginx не установлен в текущем окружении, синтаксическая проверка пропущена"
fi
