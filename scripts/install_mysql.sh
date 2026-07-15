#!/bin/bash
echo "[CloudBanana] Installing MySQL Server..."
apt update -qq && apt install -y mysql-server
systemctl enable mysql
systemctl start mysql
echo "[CloudBanana] MySQL Server installation complete"
