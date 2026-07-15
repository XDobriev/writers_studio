#!/bin/bash
# Одноразовый скрипт усиления безопасности VPS для avtorstudio.com.
# Запускать от root после vps-setup.sh:
#   ssh root@72.56.232.231 'bash -s' < deploy/security-hardening.sh

set -e

DEPLOY_USER="deploy"
APP_DIR="/var/www/avtorstudio"
SUDOERS_FILE="/etc/sudoers.d/deploy"
NGINX_WRAPPER="/usr/local/sbin/deploy-nginx-conf.sh"

echo "==> [1/5] Установка root-owned обёртки для копирования nginx.conf..."

cat > "$NGINX_WRAPPER" << 'EOF'
#!/bin/bash
# Управляется автоматически — см. deploy/deploy-nginx-conf.sh в репозитории.
# Копирует staged nginx.conf в sites-available только если источник — обычный файл
# (не симлинк). Без этой проверки голый `sudo cp` был arbitrary-root-file-read:
# deploy владеет /var/www/avtorstudio/nginx.conf и мог подменить его симлинком на
# /etc/shadow — cp по умолчанию разыменовывает симлинки источника.
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
EOF

chown root:root "$NGINX_WRAPPER"
chmod 755 "$NGINX_WRAPPER"
echo "    wrapper OK: $NGINX_WRAPPER (root:root, 755 — deploy не может изменить)"

echo "==> [2/5] Настройка судоерс-правила для пользователя deploy..."

cat > "$SUDOERS_FILE" << 'EOF'
# Управляется автоматически — см. deploy/sudoers.d-deploy в репозитории.
# Изменять только через файл в репо, затем перезапускать этот скрипт.
deploy ALL=(ALL) NOPASSWD: /usr/local/sbin/deploy-nginx-conf.sh
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
EOF

chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"
echo "    sudoers OK: $SUDOERS_FILE"

echo "==> [3/5] Ограничение прав на authorized_keys..."
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "    authorized_keys OK"

echo "==> [4/5] Запрет входа root по паролю (SSH)..."
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sshd -t && (systemctl reload ssh 2>/dev/null || systemctl reload sshd)
echo "    sshd hardened: root=key-only, password=disabled"

echo "==> [5/5] Установка fail2ban (защита от брутфорса SSH)..."
if ! command -v fail2ban-server &>/dev/null; then
    apt-get install -y fail2ban
fi
systemctl enable --now fail2ban
echo "    fail2ban активен"

echo ""
echo "==> Хардинг завершён."
echo ""
echo "ВАЖНО: Проверить что судоерс-правило не расширено лишним:"
echo "  sudo -l -U $DEPLOY_USER"
echo ""
echo "Ожидаемый вывод — ровно 3 строки NOPASSWD:"
echo "  /usr/local/sbin/deploy-nginx-conf.sh"
echo "  /usr/sbin/nginx -t"
echo "  /bin/systemctl reload nginx"
