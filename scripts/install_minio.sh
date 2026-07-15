#!/bin/bash
echo "[CloudBanana] Installing MinIO..."
wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
chmod +x /usr/local/bin/minio
useradd -r -s /usr/sbin/nologin minio 2>/dev/null || true
mkdir -p /mnt/data /etc/minio
cat > /etc/default/minio <<'EOF'
MINIO_VOLUMES="/mnt/data"
MINIO_OPTS="--console-address :9001"
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=cloudbanana123
EOF
cat > /etc/systemd/system/minio.service <<'UNIT'
[Unit]
Description=MinIO Object Storage
After=network.target
[Service]
User=minio
Group=minio
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable minio
systemctl start minio
echo "[CloudBanana] MinIO running on :9000 (console :9001)"
