#!/bin/bash
echo "[CloudBanana] Installing SQLite..."
apt update -qq && apt install -y sqlite3
echo "[CloudBanana] SQLite installation complete"
