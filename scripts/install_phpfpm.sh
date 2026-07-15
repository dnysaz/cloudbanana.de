#!/bin/bash
echo "[CloudBanana] Installing PHP-FPM..."
apt update -qq && apt install -y php-fpm
systemctl enable php*-fpm
systemctl start php*-fpm
echo "[CloudBanana] PHP-FPM installation complete"
