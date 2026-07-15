#!/usr/bin/env bash
# ============================================================
#  CloudBanana DE — CLI Management Script
#  Integrated with systemd for auto-start on reboot.
#  Usage: cloudbanana {start|stop|restart|status|logs|enable|disable|-v}
# ============================================================
set -e

CLOUDBANANA_DIR="/etc/cloudbanana"
SERVICE_NAME="cloudbanana"
VERSION="0.1.0"

# Read port from file (created by install.sh)
if [ -f "$CLOUDBANANA_DIR/.port" ]; then
    PORT=$(cat "$CLOUDBANANA_DIR/.port")
else
    PORT="8888"
fi

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[CloudBanana]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }

# Check if systemd service exists
service_exists() {
    systemctl list-unit-files "$SERVICE_NAME.service" &>/dev/null
}

case "${1:-}" in
    start)
        if service_exists; then
            info "Starting CloudBanana DE v$VERSION via systemd..."
            systemctl start "$SERVICE_NAME"
            systemctl start nginx 2>/dev/null || true
            SERVER_IP=$(hostname -I | awk '{print $1}')
            ok "CloudBanana DE running at http://$SERVER_IP:$PORT"
        else
            err "Service '$SERVICE_NAME' is not registered. Run 'sudo bash install.sh' first."
            exit 1
        fi
        ;;
    stop)
        if service_exists; then
            info "Stopping CloudBanana DE..."
            systemctl stop "$SERVICE_NAME"
            ok "CloudBanana DE stopped"
        else
            err "Service '$SERVICE_NAME' not found."
            exit 1
        fi
        ;;
    restart)
        if service_exists; then
            info "Restarting CloudBanana DE..."
            systemctl restart "$SERVICE_NAME"
            SERVER_IP=$(hostname -I | awk '{print $1}')
            ok "CloudBanana DE restarted. Access: http://$SERVER_IP:$PORT"
        else
            err "Service '$SERVICE_NAME' is not registered."
            exit 1
        fi
        ;;
    status)
        if service_exists; then
            echo ""
            echo -e "${CYAN}CloudBanana DE v$VERSION — Status${NC}"
            echo ""
            systemctl is-active --quiet "$SERVICE_NAME" && ok "Service:   RUNNING" || err "Service:   STOPPED"
            systemctl is-enabled --quiet "$SERVICE_NAME" && ok "Auto-start: ENABLED (on reboot)" || warn "Auto-start: DISABLED"
            echo ""
            echo -e "  ${CYAN}Access:${NC}  http://$(hostname -I | awk '{print $1}'):$PORT"
            echo -e "  ${CYAN}Site:${NC}    https://cloudbanana.de"
            echo -e "  ${CYAN}Logs:${NC}   cloudbanana logs"
            echo ""
        else
            warn "CloudBanana DE is not installed. Run: sudo bash install.sh"
        fi
        ;;
    logs)
        journalctl -u "$SERVICE_NAME" -f --no-hostname -o short-iso
        ;;
    enable)
        info "Enabling auto-start on reboot..."
        systemctl enable "$SERVICE_NAME"
        ok "CloudBanana will start automatically after VPS reboot"
        ;;
    disable)
        info "Disabling auto-start..."
        systemctl disable "$SERVICE_NAME"
        warn "CloudBanana will NOT start automatically after reboot"
        ;;
    -v|--version|version)
        echo "CloudBanana DE v$VERSION"
        ;;
    *)
        echo ""
        echo -e "${CYAN}CloudBanana DE v$VERSION — Lightweight VPS Desktop Environment${NC}"
echo -e "${CYAN}  https://cloudbanana.de${NC}"
        echo ""
        echo -e "  ${YELLOW}Usage:${NC} cloudbanana {command}"
        echo ""
        echo -e "  ${CYAN}start${NC}     Start service (systemd)"
        echo -e "  ${CYAN}stop${NC}      Stop service"
        echo -e "  ${CYAN}restart${NC}   Restart service"
        echo -e "  ${CYAN}status${NC}    Check status & auto-start"
        echo -e "  ${CYAN}logs${NC}      View real-time logs (journalctl -f)"
        echo -e "  ${CYAN}enable${NC}    Enable auto-start on reboot"
        echo -e "  ${CYAN}disable${NC}   Disable auto-start"
        echo -e "  ${CYAN}-v${NC}        Show version"
        echo ""
        ;;
esac
