#!/bin/bash
# Скрипт первичной настройки Timeweb VPS (Ubuntu 22.04)
# Запускать от root один раз после создания сервера:
# ssh root@<IP> 'bash -s' < deploy/vps-setup.sh

set -e

DOMAIN="avtorstudio.com"
DEPLOY_USER="deploy"
APP_DIR="/var/www/avtorstudio"

# --- Обновление системы ---
apt-get update -y && apt-get upgrade -y

# --- Nginx + Certbot ---
apt-get install -y nginx certbot python3-certbot-nginx

# --- Создать deploy-пользователя (для GitHub Actions) ---
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

# --- Директория приложения ---
mkdir -p "$APP_DIR/dist"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod 755 "$APP_DIR"

# --- SSH-ключ для deploy-пользователя (добавить вручную после генерации) ---
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# --- Nginx конфиг ---
cp /dev/stdin /etc/nginx/sites-available/"$DOMAIN" << 'NGINX_EOF'
# Временный конфиг до получения SSL-сертификата
server {
    listen 80;
    server_name avtorstudio.com www.avtorstudio.com;
    root /var/www/avtorstudio/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# --- SSL (запустить после того, как DNS начнёт смотреть на этот IP) ---
echo ""
echo "==> Настройка завершена."
echo "==> После того, как DNS avtorstudio.com укажет на этот сервер, запусти:"
echo "    certbot --nginx -d avtorstudio.com -d www.avtorstudio.com"
echo "    Затем замени /etc/nginx/sites-available/avtorstudio.com на deploy/nginx.conf"
echo "==> Добавь SSH-публичный ключ для GitHub Actions в:"
echo "    /home/$DEPLOY_USER/.ssh/authorized_keys"
