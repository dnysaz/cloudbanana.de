#!/bin/bash
echo "[CloudBanana] Installing Memcached..."
apt update -qq && apt install -y memcached libmemcached-tools
systemctl enable memcached
systemctl start memcached
echo "[CloudBanana] Memcached installation complete"
