#!/bin/bash
# Одноразовый скрипт усиления безопасности VPS для avtorstudio.com.
# Запускать от root после vps-setup.sh:
#   ssh root@72.56.232.231 'bash -s' < deploy/security-hardening.sh

set -e

DEPLOY_USER="deploy"
APP_DIR="/var/www/avtorstudio"
SUDOERS_FILE="/etc/sudoers.d/deploy"

echo "==> [1/4] Настройка судоерс-правила для пользователя deploy..."

cat > "$SUDOERS_FILE" << 'EOF'
# Управляется автоматически — см. deploy/sudoers.d-deploy в репозитории.
# Изменять только через файл в репо, затем перезапускать этот скрипт.
deploy ALL=(ALL) NOPASSWD: /bin/cp /var/www/avtorstudio/nginx.conf /etc/nginx/sites-available/avtorstudio.com
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
EOF

chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"
echo "    sudoers OK: $SUDOERS_FILE"

echo "==> [2/4] Ограничение прав на authorized_keys..."
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "    authorized_keys OK"

echo "==> [3/4] Запрет входа root по паролю (SSH)..."
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl reload sshd
echo "    sshd hardened: root=key-only, password=disabled"

echo "==> [4/4] Установка fail2ban (защита от брутфорса SSH)..."
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
echo "  /bin/cp /var/www/avtorstudio/nginx.conf /etc/nginx/sites-available/avtorstudio.com"
echo "  /usr/sbin/nginx -t"
echo "  /bin/systemctl reload nginx"
