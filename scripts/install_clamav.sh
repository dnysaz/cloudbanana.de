#!/bin/bash
echo "[CloudBanana] Installing ClamAV..."
apt update -qq && apt install -y clamav clamav-daemon
systemctl stop clamav-freshclam 2>/dev/null || true
freshclam --quiet || true
systemctl start clamav-freshclam 2>/dev/null || true
systemctl enable clamav-daemon
systemctl start clamav-daemon
echo "[CloudBanana] ClamAV installation complete"
