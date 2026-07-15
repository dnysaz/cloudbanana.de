#!/bin/bash
echo "[CloudBanana] Installing Prometheus..."
useradd -rs /usr/sbin/nologin prometheus 2>/dev/null || true
VER=$(curl -s https://api.github.com/repos/prometheus/prometheus/releases/latest | grep tag_name | cut -d'"' -f4 | sed 's/^v//')
wget -q "https://github.com/prometheus/prometheus/releases/download/v$VER/prometheus-$VER.linux-amd64.tar.gz" -O /tmp/prometheus.tar.gz
tar xzf /tmp/prometheus.tar.gz -C /tmp/
mkdir -p /etc/prometheus /var/lib/prometheus
cp /tmp/prometheus-$VER.linux-amd64/prometheus /usr/local/bin/
cp /tmp/prometheus-$VER.linux-amd64/promtool /usr/local/bin/
cp -r /tmp/prometheus-$VER.linux-amd64/consoles /etc/prometheus
cp -r /tmp/prometheus-$VER.linux-amd64/console_libraries /etc/prometheus
chown -R prometheus:prometheus /etc/prometheus /var/lib/prometheus /usr/local/bin/prometheus /usr/local/bin/promtool
cat > /etc/systemd/system/prometheus.service <<'UNIT'
[Unit]
Description=Prometheus
After=network.target
[Service]
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/prometheus/prometheus.yml <<'YML'
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
YML
systemctl daemon-reload
systemctl enable prometheus
systemctl start prometheus
rm -rf /tmp/prometheus*
echo "[CloudBanana] Prometheus running on :9090"
