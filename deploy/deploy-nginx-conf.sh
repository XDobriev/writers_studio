#!/bin/bash
# Root-owned обёртка, вызываемая через sudo (см. deploy/sudoers.d-deploy).
# Install on VPS: sudo install -o root -g root -m 755 deploy/deploy-nginx-conf.sh /usr/local/sbin/deploy-nginx-conf.sh
#
# Копирует staged nginx.conf в sites-available только если источник — обычный файл
# (не симлинк). Без этой проверки голый `sudo cp SRC DST` был arbitrary-root-file-read:
# deploy владеет /var/www/avtorstudio/nginx.conf и мог подменить его симлинком на
# /etc/shadow — cp по умолчанию разыменовывает симлинки источника, sudo выполнял бы
# чтение как root и писал бы результат в мировидимый /etc/nginx/sites-available/.
set -euo pipefail

SRC="/var/www/avtorstudio/nginx.conf"
DST="/etc/nginx/sites-available/avtorstudio.com"

if [ -L "$SRC" ]; then
    echo "refuse: $SRC is a symlink" >&2
    exit 1
fi

if [ ! -f "$SRC" ]; then
    echo "refuse: $SRC is not a regular file" >&2
    exit 1
fi

install -o root -g root -m 644 "$SRC" "$DST"
