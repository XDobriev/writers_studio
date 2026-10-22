#!/bin/bash
# Root-owned обёртка, вызываемая через sudo (см. deploy/sudoers.d-deploy).
# Install on VPS: sudo install -o root -g root -m 755 deploy/deploy-nginx-conf.sh /usr/local/sbin/deploy-nginx-conf.sh
#
# Копирует staged nginx.conf в sites-available только если источник — обычный файл
# (не симлинк). Без этой проверки голый `sudo cp SRC DST` был arbitrary-root-file-read:
# deploy владеет /var/www/avtorstudio/nginx.conf и мог подменить его симлинком на
# /etc/shadow — cp по умолчанию разыменовывает симлинки источника, sudo выполнял бы
# чтение как root и писал бы результат в мировидимый /etc/nginx/sites-available/.
#
# Порядок, чтобы битый конфиг не остался на месте (иначе nginx не поднимется после
# reboot/restart, даже если reload не случился):
#   1. Снимок staged-файла во временный root-owned файл (deploy больше не может его менять).
#   2. nginx -t на временном главном конфиге, где вместо текущего сайта подключён новый
#      файл, — ДО установки.
#   3. Бэкап текущего конфига в $DST.bak, установка, повторный nginx -t на боевом конфиге.
#      Не прошёл — откат на .bak.
set -euo pipefail

SRC="/var/www/avtorstudio/nginx.conf"
DST="/etc/nginx/sites-available/avtorstudio.com"
BAK="$DST.bak"
MAIN_CONF="/etc/nginx/nginx.conf"
SITES_ENABLED="/etc/nginx/sites-enabled"

if [ -L "$SRC" ]; then
    echo "refuse: $SRC is a symlink" >&2
    exit 1
fi

if [ ! -f "$SRC" ]; then
    echo "refuse: $SRC is not a regular file" >&2
    exit 1
fi

# Временные файлы — в /etc/nginx: относительные include (mime.types и т.п.) в
# главном конфиге разрешаются от каталога этого конфига.
WORK="$(mktemp -d /etc/nginx/.deploy-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

NEW="$WORK/new-site.conf"
install -o root -g root -m 644 "$SRC" "$NEW"

# --- Шаг 2: проверка до установки ---
if grep -qE '^[[:space:]]*include[[:space:]]+/etc/nginx/sites-enabled/\*;' "$MAIN_CONF"; then
    mkdir "$WORK/sites"
    for f in "$SITES_ENABLED"/*; do
        [ -e "$f" ] || continue
        # Текущий сайт заменяется новым файлом, остальные копируются как есть.
        if [ "$(readlink -f "$f")" = "$(readlink -f "$DST")" ]; then
            continue
        fi
        cp -L "$f" "$WORK/sites/$(basename "$f")"
    done
    cp "$NEW" "$WORK/sites/avtorstudio.com"
    sed "s#/etc/nginx/sites-enabled/\*;#$WORK/sites/*;#" "$MAIN_CONF" > "$WORK/nginx.conf"
    if ! nginx -t -q -c "$WORK/nginx.conf"; then
        echo "refuse: новый nginx.conf не прошёл nginx -t, текущий конфиг не тронут" >&2
        exit 1
    fi
else
    echo "warn: в $MAIN_CONF нет 'include /etc/nginx/sites-enabled/*;' — предварительная проверка пропущена, полагаемся на шаг 3" >&2
fi

# --- Шаг 3: установка с откатом ---
if [ -f "$DST" ]; then
    cp -p "$DST" "$BAK"
fi
install -o root -g root -m 644 "$NEW" "$DST"

if ! nginx -t -q; then
    echo "error: nginx -t не прошёл после установки — откат на $BAK" >&2
    if [ -f "$BAK" ]; then
        install -o root -g root -m 644 "$BAK" "$DST"
    fi
    exit 1
fi
