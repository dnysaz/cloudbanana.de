#!/bin/bash
echo "[CloudBanana] Installing MariaDB..."
apt update -qq && apt install -y mariadb-server
echo "[CloudBanana] MariaDB installation complete"
echo "[CloudBanana] Run 'mysql_secure_installation' to secure your installation"
