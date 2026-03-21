#!/usr/bin/env bash
# ============================================================
# Dashboard Watchdog — ensures the Express dashboard stays up.
#
# Checks if the dashboard is responding. If not, restarts it.
# Designed to run via crontab every minute.
#
# Usage: scripts/dashboard-watchdog.sh
# Crontab: * * * * * /home/claude-dev/projects/YT_Channel_Auto/scripts/dashboard-watchdog.sh
# ============================================================

set -euo pipefail

PROJECT_DIR="/home/claude-dev/projects/YT_Channel_Auto"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
DASHBOARD_URL="http://localhost:${DASHBOARD_PORT}"
PID_FILE="/tmp/yt-dashboard.pid"
LOG_FILE="${PROJECT_DIR}/logs/dashboard-watchdog.log"
MAX_LOG_SIZE=5242880  # 5MB

mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Rotate watchdog log if too large
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_SIZE" ]; then
  mv "$LOG_FILE" "${LOG_FILE}.old"
fi

# Rotate dashboard.log if too large
DASHBOARD_LOG_FILE="${PROJECT_DIR}/logs/dashboard.log"
if [ -f "$DASHBOARD_LOG_FILE" ] && [ "$(stat -c%s "$DASHBOARD_LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_SIZE" ]; then
  mv "$DASHBOARD_LOG_FILE" "${DASHBOARD_LOG_FILE}.old"
  log "Rotated dashboard.log (exceeded 5MB)"
fi

# Check if dashboard is responding
if curl -sf --max-time 5 "${DASHBOARD_URL}/api/channels" > /dev/null 2>&1; then
  # Dashboard is healthy — update PID file if we can find the process
  RUNNING_PID=$(pgrep -f "tsx src/dashboard/server.ts" 2>/dev/null | head -1 || true)
  if [ -n "$RUNNING_PID" ]; then
    echo "$RUNNING_PID" > "$PID_FILE"
  fi
  exit 0
fi

log "Dashboard not responding — attempting restart"

# Kill any zombie dashboard processes
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log "Killing unresponsive dashboard (PID $OLD_PID)"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Also kill any orphaned tsx/node processes running the dashboard
pkill -f "tsx src/dashboard/server.ts" 2>/dev/null || true
sleep 1

# Start dashboard
log "Starting dashboard..."
cd "$PROJECT_DIR"

# Source environment (nvm, node, etc.)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nohup npx tsx src/dashboard/server.ts >> "${PROJECT_DIR}/logs/dashboard.log" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
log "Dashboard started (PID $NEW_PID)"

# Wait briefly and verify it came up
sleep 3
if curl -sf --max-time 5 "${DASHBOARD_URL}/api/channels" > /dev/null 2>&1; then
  log "Dashboard verified healthy after restart"
else
  log "WARNING: Dashboard started but not responding yet — may need more startup time"
fi
