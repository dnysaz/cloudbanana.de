#!/bin/bash
echo "[CloudBanana] Installing UFW..."
apt update -qq && apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
echo "[CloudBanana] UFW installation complete. Run 'ufw enable' to activate."
