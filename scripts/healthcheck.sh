#!/bin/bash
# CloudBanana Health Check Watchdog
# Pings the backend every 30s via systemd timer. 
# If dead/hung: force-kill then restart.

HEALTH_URL="http://127.0.0.1:8001/api/v1/auth/check"
SERVICE="cloudbanana"
LOG_TAG="cloudbanana-watchdog"

# Try to reach the health endpoint with a 5s timeout
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>&1)
EXIT_CODE=$?

# Consider unhealthy if: curl failed (exit != 0) OR HTTP code not 200
if [ "$EXIT_CODE" -ne 0 ] || [ "$HTTP_CODE" != "200" ]; then
    logger -t "$LOG_TAG" "Health check FAILED (HTTP=$HTTP_CODE exit=$EXIT_CODE) — force-killing $SERVICE"
    # Force kill everything on port 8001, then restart cleanly
    fuser -k -9 8001/tcp 2>/dev/null
    sleep 1
    systemctl kill -s SIGKILL "$SERVICE" 2>/dev/null
    sleep 1
    systemctl reset-failed "$SERVICE" 2>/dev/null
    systemctl restart "$SERVICE"
    logger -t "$LOG_TAG" "Restarted $SERVICE"
    exit 0
fi

exit 0
