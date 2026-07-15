#!/bin/bash
echo "[CloudBanana] Installing Elasticsearch..."
apt update -qq && apt install -y apt-transport-https curl
curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" > /etc/apt/sources.list.d/elastic-8.x.list
apt update -qq && apt install -y elasticsearch
echo "xpack.security.enabled: false" >> /etc/elasticsearch/elasticsearch.yml
systemctl enable elasticsearch
systemctl start elasticsearch
echo "[CloudBanana] Elasticsearch installation complete"
