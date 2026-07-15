#!/bin/bash
echo "[CloudBanana] Installing MongoDB..."
apt update -qq && apt install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update -qq && apt install -y mongodb-org
echo "[CloudBanana] MongoDB installation complete"
