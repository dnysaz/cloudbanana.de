#!/bin/bash
echo "[CloudBanana] Installing Go..."
VERSION=$(curl -sL https://go.dev/dl/ | grep -oP 'go[\d]+\.[\d]+\.[\d]+' | head -1 | sed 's/go//')
if [ -z "$VERSION" ]; then VERSION="1.22.5"; fi
wget -q "https://go.dev/dl/go$VERSION.linux-amd64.tar.gz" -O /tmp/go.tar.gz
rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
chmod +x /etc/profile.d/go.sh
rm /tmp/go.tar.gz
echo "[CloudBanana] Go $VERSION installed to /usr/local/go"
