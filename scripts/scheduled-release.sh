#!/usr/bin/env bash
# ============================================================
# Scheduled Release — flips one "scheduled" production to
# "pending_script" if its scheduledDate matches today.
# Runs daily via cron. The production watcher then picks it up.
#
# Crontab: 0 6 * * * /home/claude-dev/projects/YT_Channel_Auto/scripts/scheduled-release.sh
# ============================================================

set -euo pipefail

PROJECT_DIR="/home/claude-dev/projects/YT_Channel_Auto"
LOG_FILE="${PROJECT_DIR}/logs/scheduled-release.log"
TODAY=$(date '+%Y-%m-%d')

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

log "Checking for scheduled productions on $TODAY"

FOUND=0
for channel_dir in "$PROJECT_DIR"/projects/ch-*/; do
  [ -d "$channel_dir/output" ] || continue
  slug=$(basename "$channel_dir")

  for prod_dir in "$channel_dir"/output/*/; do
    status_file="$prod_dir/pipeline-status.json"
    [ -f "$status_file" ] || continue

    stage=$(python3 -c "import json; print(json.load(open('$status_file')).get('stage',''))" 2>/dev/null)
    [ "$stage" = "scheduled" ] || continue

    sched_date=$(python3 -c "import json; print(json.load(open('$status_file')).get('scheduledDate',''))" 2>/dev/null)
    [ "$sched_date" = "$TODAY" ] || continue

    prod_id=$(basename "$prod_dir")
    topic=$(python3 -c "import json; print(json.load(open('$status_file')).get('topic','unknown'))" 2>/dev/null)

    # Flip to pending_script
    python3 -c "
import json
from datetime import datetime, timezone
with open('$status_file') as f:
    d = json.load(f)
d['stage'] = 'pending_script'
d['updatedAt'] = datetime.now(timezone.utc).isoformat()
with open('$status_file', 'w') as f:
    json.dump(d, f, indent=2)
"
    log "Released: $slug / $prod_id — $topic (was scheduled for $sched_date)"
    FOUND=$((FOUND + 1))
  done
done

if [ "$FOUND" -eq 0 ]; then
  log "No productions scheduled for today"
fi
