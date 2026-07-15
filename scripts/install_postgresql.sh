#!/bin/bash
echo "[CloudBanana] Installing PostgreSQL..."
apt update -qq && apt install -y postgresql postgresql-contrib
echo "[CloudBanana] PostgreSQL installation complete"
