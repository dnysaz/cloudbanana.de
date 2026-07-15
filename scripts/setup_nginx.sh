#!/bin/bash
# ============================================================
#  CloudBanana — Nginx Configuration Script
#  Auto-detect port jika tidak ditentukan.
#  Digunakan oleh install.sh secara otomatis.
# ============================================================
set -e

CLOUDBANANA_DIR="/etc/cloudbanana"
INSTALL_DIR="${CLOUDBANANA_DIR}"

DOMAIN="${1:-}"
PORT="${2:-}"

# Auto-detect port dari file .port
if [ -z "$PORT" ] && [ -f "$INSTALL_DIR/.port" ]; then
    PORT=$(cat "$INSTALL_DIR/.port")
fi

# Fallback port
if [ -z "$PORT" ]; then
    PORT="8888"
    # Cari port yang tersedia
    while ss -tln 2>/dev/null | grep -q ":$PORT "; do
        PORT=$((PORT + 1))
    done
fi

# Auto-detect domain/IP
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(hostname -I 2>/dev/null | awk '{print $1}') || DOMAIN="localhost"
fi

echo "[CloudBanana] Configuring Nginx for $DOMAIN on port $PORT..."

cat > /etc/nginx/sites-available/cloudbanana <<NGINXEOF
server {
    listen $PORT;
    server_name $DOMAIN;

    root $INSTALL_DIR/frontend/dist;

    gzip on;
    gzip_types text/css application/javascript text/plain text/html image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets with hashed filenames (Vite adds hash)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Never cache index.html so new builds are picked up immediately
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_connect_timeout 10;
        proxy_read_timeout 30;
        proxy_send_timeout 10;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/v1/terminal/ws {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    client_max_body_size 100m;
}
NGINXEOF

# Hapus default site
rm -f /etc/nginx/sites-enabled/default

# Aktifkan site
ln -sf /etc/nginx/sites-available/cloudbanana /etc/nginx/sites-enabled/

# Test & reload
if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null
    echo "[CloudBanana] Nginx configured on port $PORT."
else
    echo "[CloudBanana] Warning: Nginx config test failed. Run 'nginx -t' manually."
fi

# Simpan port
echo "$PORT" > "$INSTALL_DIR/.port"
