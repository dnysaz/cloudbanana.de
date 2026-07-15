#!/bin/bash
echo "[CloudBanana] Installing Bun..."
apt update -qq && apt install -y unzip curl
curl -fsSL https://bun.sh/install | bash
echo "[CloudBanana] Bun installation complete. Run 'source ~/.bashrc' or exec $HOME/.bun/bin/bun"
