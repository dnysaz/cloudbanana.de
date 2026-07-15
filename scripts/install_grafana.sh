#!/bin/bash
echo "[CloudBanana] Installing Grafana..."
apt update -qq && apt install -y apt-transport-https curl gnupg
curl -fsSL https://packages.grafana.com/gpg.key | gpg --dearmor -o /usr/share/keyrings/grafana.gpg
echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://packages.grafana.com/oss/deb stable main" > /etc/apt/sources.list.d/grafana.list
apt update -qq && apt install -y grafana
systemctl enable grafana-server
systemctl start grafana-server
echo "[CloudBanana] Grafana running on :3000 (admin/admin)"
