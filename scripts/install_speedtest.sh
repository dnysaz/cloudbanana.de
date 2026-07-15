#!/bin/bash
echo "[CloudBanana] Installing Speedtest CLI..."
apt update -qq && apt install -y curl
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash
apt install -y speedtest-cli
echo "[CloudBanana] Speedtest CLI installation complete"
