#!/bin/bash
echo "[CloudBanana] Installing Fail2ban..."
apt update -qq && apt install -y fail2ban
systemctl enable fail2ban
echo "[CloudBanana] Fail2ban installation complete"
