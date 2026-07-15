#!/bin/bash
echo "[CloudBanana] Installing Lynis..."
apt update -qq && apt install -y lynis
echo "[CloudBanana] Lynis installation complete"
