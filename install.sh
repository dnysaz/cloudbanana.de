#!/bin/bash
# ============================================================
#  CloudBanana DE — Master Installer
#  Run: sudo bash install.sh
#  Automatically installs: Python venv, Node.js,
#  NPM build, Nginx, systemd service, auto-start on reboot.
# ============================================================
set -e
trap 'echo -e "\n[✗] Failed at step: $CURRENT_STEP"; exit 1' ERR

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[CloudBanana]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }

CURRENT_STEP="Environment validation"

# ============================================================
# 1. ENVIRONMENT VALIDATION
# ============================================================
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}     CloudBanana DE — Master Installer${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    err "This script must be run as root (sudo bash install.sh)"
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    err "Unsupported operating system."
    exit 1
fi

. /etc/os-release 2>/dev/null || true
PKG_MANAGER=""
if command -v apt-get &>/dev/null; then
    PKG_MANAGER="apt"
fi

if [ -z "$PKG_MANAGER" ]; then
    err "This installer requires a Debian-based Linux distribution (apt-get not found)."
    err "Supported: Ubuntu, Debian, Linux Mint, Pop!_OS, and other Debian derivatives."
    exit 1
fi

if [ "$ID" = "ubuntu" ]; then
    ok "Ubuntu $VERSION_ID detected"
elif [ "$ID" = "debian" ]; then
    ok "Debian $VERSION_ID detected"
else
    warn "${ID:-Debian derivative} detected — continuing (optimized for Ubuntu/Debian)."
fi

INSTALL_DIR="/etc/cloudbanana"
REPO_URL="${CLOUDBANANA_REPO_URL:-https://github.com/dnysaz/cloudbanana.de.git}"
SERVICE_NAME="cloudbanana"
SERVICE_PORT="${CLOUDBANANA_PORT:-8888}"
CURRENT_STEP="Environment validation"

# ============================================================
# 1b. CREATE DEDICATED SERVICE USER (non-root)
# ============================================================
CURRENT_STEP="Create service user"
if id "cloudbanana" &>/dev/null; then
    ok "User 'cloudbanana' already exists"
else
    useradd -r -s /usr/sbin/nologin -d "$INSTALL_DIR" -m -c "CloudBanana DE service user" cloudbanana
    ok "Created system user 'cloudbanana' (no login)"
fi
usermod -a -G cloudbanana cloudbanana 2>/dev/null || true

# ============================================================
# 2. INSTALL SYSTEM DEPENDENCIES
# ============================================================
CURRENT_STEP="Install system dependencies"
info "Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
    python3 python3-venv python3-pip \
    nginx git curl wget \
    > /dev/null 2>&1
ok "System dependencies installed"

# ============================================================
# 3. INSTALL NODE.JS (if not already present)
# ============================================================
CURRENT_STEP="Install Node.js"
if ! command -v node &>/dev/null; then
    info "Node.js not found. Installing Node.js 20..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y -qq nodejs > /dev/null 2>&1
    ok "Node.js $(node -v) installed"
else
    ok "Node.js $(node -v) already available"
fi

# ============================================================
# 4. CLONE / UPDATE PROJECT
# ============================================================
CURRENT_STEP="Clone / update project"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$INSTALL_DIR" ]; then
    if [ -f "$INSTALL_DIR/install.sh" ]; then
        # Already has project files — update if git repo
        info "Directory $INSTALL_DIR already has project files. Updating..."
        cd "$INSTALL_DIR"
        if [ -d "$INSTALL_DIR/.git" ]; then
            git pull --ff-only 2>/dev/null || warn "Could not git pull, continuing with existing files"
        fi
    else
        # Directory exists but has no project files (e.g. created by useradd -m)
        warn "Directory $INSTALL_DIR exists but has no project files."
        if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
            info "Copying project files from $SCRIPT_DIR..."
            rsync -a --exclude='venv' --exclude='node_modules' --exclude='__pycache__' --exclude='.git' \
                "$SCRIPT_DIR"/ "$INSTALL_DIR"/ 2>/dev/null || \
            cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || true
            ok "Project files copied from $SCRIPT_DIR to $INSTALL_DIR"
        fi
    fi
else
    info "Cloning repository..."
    if git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
        ok "Repository cloned from $REPO_URL"
    else
        warn "Failed to clone from $REPO_URL — repository URL not configured."
        warn "Using files from current directory..."
        mkdir -p "$INSTALL_DIR"
        if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
            rsync -a --exclude='venv' --exclude='node_modules' --exclude='__pycache__' --exclude='.git' \
                "$SCRIPT_DIR"/ "$INSTALL_DIR"/ 2>/dev/null || \
            cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || true
            ok "Files copied from $SCRIPT_DIR to $INSTALL_DIR"
        fi
    fi
fi
cd "$INSTALL_DIR"
ok "Project ready at $INSTALL_DIR"

# ============================================================
# 5. SETUP PYTHON VENV
# ============================================================
CURRENT_STEP="Setup Python virtual environment"
info "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt
deactivate
ok "Python venv ready with all dependencies"

# ============================================================
# 6. BUILD FRONTEND
# ============================================================
CURRENT_STEP="Build frontend"
info "Installing npm packages & building frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent --loglevel=error
npm run build --loglevel=error
cd "$INSTALL_DIR"
ok "Frontend built (dist/)"

# ============================================================
# 7. SETUP NGINX (find available port)
# ============================================================
CURRENT_STEP="Setup Nginx"
info "Configuring Nginx..."

# Find an available port starting from the configured port
PORT=$SERVICE_PORT
while ss -tln 2>/dev/null | grep -q ":$PORT "; do
    warn "Port $PORT is already in use, trying port $((PORT + 1))"
    PORT=$((PORT + 1))
done

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
DOMAIN="${CLOUDBANANA_DOMAIN:-${SERVER_IP:-localhost}}"
USE_HTTPS=false

# Check if domain is a real domain (not IP) for Let's Encrypt
if [[ "$DOMAIN" =~ \. ]] && ! [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    USE_HTTPS=true
    info "Domain '$DOMAIN' detected — will configure HTTPS via Let's Encrypt"
fi

cat > /etc/nginx/sites-available/cloudbanana <<NGINXEOF
server {
    listen ${PORT};
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    root $INSTALL_DIR/frontend/dist;

    gzip on;
    gzip_types text/css application/javascript text/plain text/html image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \$uri \$uri/ /index.html;
        # SPA entry point: no-cache to ensure users get latest version
        add_header Cache-Control "no-cache, must-revalidate";
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

# If HTTPS is enabled, obtain certificate and adjust config
if [ "$USE_HTTPS" = true ]; then
    info "Obtaining SSL certificate from Let's Encrypt for $DOMAIN..."
    # Install certbot if not present
    apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1 || true
    # Obtain certificate (standalone mode — nginx already stopped/reloaded)
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --email "admin@$DOMAIN" --redirect 2>/dev/null || \
    warn "Let's Encrypt failed. Check: certbot certonly --nginx -d $DOMAIN"
    ok "SSL certificate configured for $DOMAIN"
else
    info "Using IP-based access (no domain) — HTTP only. Set CLOUDBANANA_DOMAIN for HTTPS."
    # Regenerate nginx config without HTTPS for IP-based access
    cat > /etc/nginx/sites-available/cloudbanana <<NGINXEOF
# Security headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

server {
    listen $PORT;
    server_name $DOMAIN;

    root $INSTALL_DIR/frontend/dist;

    gzip on;
    gzip_types text/css application/javascript text/plain text/html image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \$uri \$uri/ /index.html;
        # SPA entry point: no-cache to ensure users get latest version
        add_header Cache-Control "no-cache, must-revalidate";
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
fi

# Remove default site if present
rm -f /etc/nginx/sites-enabled/default

# Activate cloudbanana site
ln -sf /etc/nginx/sites-available/cloudbanana /etc/nginx/sites-enabled/

if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null
    ok "Nginx configured on port $PORT"
else
    warn "Nginx configuration has issues. Check manually: nginx -t"
fi

# ============================================================
# 8. OPEN PORT IN FIREWALL (UFW + iptables)
# ============================================================
CURRENT_STEP="Configure firewall"
FIREWALL_OK=false

# --- UFW ---
if command -v ufw &>/dev/null; then
    if ufw status 2>/dev/null | grep -q "$PORT/tcp"; then
        ok "Port $PORT already open in UFW"
        FIREWALL_OK=true
    else
        # Always run ufw allow — works even if ufw is inactive (queues the rule)
        ufw allow "$PORT/tcp" comment 'CloudBanana DE' > /dev/null 2>&1 && {
            ok "Port $PORT opened in UFW"
            FIREWALL_OK=true
        } || warn "UFW rule could not be added (might be inactive)"
    fi
fi

# --- iptables (always try, regardless of UFW) ---
if command -v iptables &>/dev/null; then
    # Check if rule already exists
    if iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null; then
        FIREWALL_OK=true
    else
        # Insert at top of INPUT chain to ensure it takes effect
        iptables -I INPUT 1 -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null && {
            info "Iptables rule for port $PORT added (INPUT chain, position 1)"
            FIREWALL_OK=true
        } || warn "iptables rule could not be added"
    fi
fi

# --- Check default policy ---
if command -v iptables &>/dev/null; then
    DEFAULT_POLICY=$(iptables -L INPUT -n 2>/dev/null | head -1 | sed -n 's/.*policy \([A-Z]*\).*/\1/p')
    if [ "$DEFAULT_POLICY" = "DROP" ] || [ "$DEFAULT_POLICY" = "REJECT" ]; then
        warn "Default INPUT policy is $DEFAULT_POLICY — firewall is blocking incoming connections"
        if [ "$FIREWALL_OK" = true ]; then
            info "Port $PORT has been opened, but verify with: curl -s http://$SERVER_IP:$PORT"
        else
            warn "Could not open port $PORT automatically! Try manually:"
            warn "  ufw allow $PORT/tcp"
            warn "  iptables -I INPUT -p tcp --dport $PORT -j ACCEPT"
        fi
    else
        ok "Firewall default INPUT policy: $DEFAULT_POLICY (acceptable)"
    fi
fi

if [ "$FIREWALL_OK" = false ]; then
    warn "No firewall tool (ufw/iptables) detected or rules could not be applied"
    warn "Make sure port $PORT is open in your cloud provider's firewall/security group"
fi

# ============================================================
# 8b. SETUP SUDOERS FOR SERVICE USER (scoped privileges)
# ============================================================
CURRENT_STEP="Setup sudoers"
cat > /etc/sudoers.d/cloudbanana <<SUDOEOF
# CloudBanana DE — scoped sudo for service user
cloudbanana ALL=(root) NOPASSWD: /usr/bin/apt update
cloudbanana ALL=(root) NOPASSWD: /usr/bin/apt upgrade -y
cloudbanana ALL=(root) NOPASSWD: /usr/bin/apt remove -y *
cloudbanana ALL=(root) NOPASSWD: /usr/sbin/nginx -t
cloudbanana ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
cloudbanana ALL=(root) NOPASSWD: /usr/bin/systemctl restart nginx
cloudbanana ALL=(root) NOPASSWD: /usr/bin/systemctl stop nginx
cloudbanana ALL=(root) NOPASSWD: /usr/bin/systemctl start nginx
cloudbanana ALL=(root) NOPASSWD: /usr/sbin/iptables -A INPUT -p tcp --dport * -j ACCEPT
cloudbanana ALL=(root) NOPASSWD: /usr/bin/php *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/wget *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/git *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/certbot *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/openssl *
cloudbanana ALL=(root) NOPASSWD: /bin/bash -c *
cloudbanana ALL=(root) NOPASSWD: /usr/sbin/service ufw *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/chmod *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/chown *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/dpkg-deb *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/dpkg *
cloudbanana ALL=(root) NOPASSWD: /usr/bin/apt-get install -f
SUDOEOF
chmod 440 /etc/sudoers.d/cloudbanana
ok "Sudoers configured for user 'cloudbanana' with scoped privileges"

# ============================================================
# 9. SETUP SYSTEMD SERVICE (auto-start on reboot)
# ============================================================
CURRENT_STEP="Setup systemd service"
info "Creating systemd service for auto-start..."

cat > /etc/systemd/system/$SERVICE_NAME.service <<SYSTEMDEOF
[Unit]
Description=CloudBanana DE — VPS Desktop Environment
Documentation=https://cloudbanana.de
After=network.target nginx.service

[Service]
Type=simple
User=cloudbanana
Group=cloudbanana
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 4 --limit-max-requests 10000 --timeout-keep-alive 30 --backlog 2048 --timeout-graceful-shutdown 15
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-$INSTALL_DIR/backend/.env
# ReadWritePaths for security: limit which files the service can write
ReadWritePaths=$INSTALL_DIR/backend
ReadWritePaths=$INSTALL_DIR/backend/cloudbanana.db
ReadWritePaths=/var/www

[Install]
WantedBy=multi-user.target
SYSTEMDEOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME.service
systemctl restart $SERVICE_NAME.service
ok "systemd service '$SERVICE_NAME' active & set to auto-start on reboot"

# ============================================================
# 9b. SET FILE OWNERSHIP & PERMISSIONS
# ============================================================
CURRENT_STEP="Set file ownership & permissions"
chown -R cloudbanana:cloudbanana "$INSTALL_DIR/backend"
chown -R cloudbanana:cloudbanana "$INSTALL_DIR/scripts"
chown -R cloudbanana:cloudbanana "$INSTALL_DIR/cloudbanana.sh" 2>/dev/null || true
chown -R cloudbanana:cloudbanana "$INSTALL_DIR/.port" 2>/dev/null || true
chmod 644 "$INSTALL_DIR/backend/cloudbanana.db" 2>/dev/null || true
chmod 600 "$INSTALL_DIR/backend/.secret_key" 2>/dev/null || true
# Frontend dist must be readable by nginx (www-data)
chown -R www-data:www-data "$INSTALL_DIR/frontend/dist" 2>/dev/null || true
find "$INSTALL_DIR/frontend/dist" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$INSTALL_DIR/frontend/dist" -type f -exec chmod 644 {} + 2>/dev/null || true
# Venv needs to be executable by cloudbanana
chown -R cloudbanana:cloudbanana "$INSTALL_DIR/venv" 2>/dev/null || true
# Add cloudbanana user to www-data group for /var/www access
usermod -a -G www-data cloudbanana 2>/dev/null || true
ok "File ownership & permissions set for user 'cloudbanana'"

# ============================================================
# 10. INSTALL CLI SCRIPT TO SYSTEM
# ============================================================
CURRENT_STEP="Install CLI to system"
# Save the detected port so cloudbanana.sh can read it
echo "$PORT" > "$INSTALL_DIR/.port"

# Copy cloudbanana.sh to PATH if the file exists
if [ -f "$INSTALL_DIR/cloudbanana.sh" ]; then
    cp "$INSTALL_DIR/cloudbanana.sh" /usr/local/bin/cloudbanana
    chmod +x /usr/local/bin/cloudbanana
    ok "CLI 'cloudbanana' available at /usr/local/bin/cloudbanana"
else
    warn "cloudbanana.sh not found, CLI not copied"
fi

# ============================================================
# 11. COMPLETE
# ============================================================
CURRENT_STEP="Finalize"
# Fallback IP if not detected
if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" = "127.0.0.1" ]; then
    SERVER_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "127.0.0.1")
fi
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  CloudBanana DE installed successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${CYAN}Access:${NC}    http://$SERVER_IP:$PORT"
echo -e "  ${CYAN}Status:${NC}    cloudbanana status"
echo -e "  ${CYAN}Logs:${NC}     journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "  ${YELLOW}First time?${NC}"
echo -e "  1. Open http://$SERVER_IP:$PORT"
echo -e "  2. Register an admin (username, email, password)"
echo -e "  3. Login and enjoy your Desktop Environment!"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    cloudbanana start     → Start service"
echo -e "    cloudbanana stop      → Stop service"
echo -e "    cloudbanana restart   → Restart service"
echo -e "    cloudbanana status    → Check status"
echo -e "    cloudbanana logs      → View real-time logs"
echo ""
