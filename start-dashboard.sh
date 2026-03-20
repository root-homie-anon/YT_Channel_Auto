#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/claude-dev/projects/YT_Channel_Auto"
LOG_FILE="${PROJECT_DIR}/logs/dashboard.log"
PID_FILE="/tmp/yt-dashboard.pid"

mkdir -p "$(dirname "$LOG_FILE")"

# Copy public assets if missing (tsc doesn't copy non-TS files)
if [ ! -d "$PROJECT_DIR/dist/public" ]; then
  cp -r "$PROJECT_DIR/src/public" "$PROJECT_DIR/dist/public"
fi

# Kill existing instance
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

cd "$PROJECT_DIR"
nohup node dist/dashboard/server.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Dashboard started (PID $!) — http://localhost:3000"
echo "Logs: $LOG_FILE"
