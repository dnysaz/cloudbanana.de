#!/bin/bash
echo "[CloudBanana] Installing Redis..."
apt update -qq && apt install -y redis-server
echo "[CloudBanana] Redis installation complete"
