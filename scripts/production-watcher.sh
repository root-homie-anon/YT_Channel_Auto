#!/usr/bin/env bash
# ============================================================
# Production Watcher — polls dashboard for pending productions
# and spawns Claude Code to process them via @content-strategist.
#
# Concurrency-limited: max 2 CC sessions at a time.
# Also picks up failed productions for retry.
#
# Designed to run via system crontab on an always-on VM.
# Usage: scripts/production-watcher.sh
# Crontab: */5 * * * * /home/claude-dev/projects/YT_Channel_Auto/scripts/production-watcher.sh
# ============================================================

set -euo pipefail

PROJECT_DIR="/home/claude-dev/projects/YT_Channel_Auto"
DASHBOARD_URL="http://localhost:3000"
LOCK_FILE="/tmp/production-watcher.lock"
LOG_FILE="${PROJECT_DIR}/logs/production-watcher.log"
SLOT_DIR="/tmp/production-watcher-slots"
MAX_CONCURRENT=2

# Ensure dirs exist
mkdir -p "$(dirname "$LOG_FILE")" "$SLOT_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Prevent overlapping watcher runs
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    log "Already running (PID $LOCK_PID), skipping"
    exit 0
  else
    log "Stale lock file, removing"
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# Clean stale slot files (PIDs no longer running)
for slot in "$SLOT_DIR"/slot-*; do
  [ -f "$slot" ] || continue
  SLOT_PID=$(cat "$slot" 2>/dev/null)
  if ! kill -0 "$SLOT_PID" 2>/dev/null; then
    rm -f "$slot"
  fi
done

# Count active slots
active_slots() {
  local count=0
  for slot in "$SLOT_DIR"/slot-*; do
    [ -f "$slot" ] && count=$((count + 1))
  done
  echo "$count"
}

# Check dashboard is running
if ! curl -sf "${DASHBOARD_URL}/api/pipelines/pending" > /dev/null 2>&1; then
  log "Dashboard not reachable, skipping"
  exit 0
fi

# Fetch pending productions
PENDING=$(curl -sf "${DASHBOARD_URL}/api/pipelines/pending" 2>/dev/null || echo "[]")
PENDING_COUNT=$(echo "$PENDING" | jq 'length' 2>/dev/null || echo "0")

# Fetch failed productions eligible for retry (from history)
# The system-status endpoint shows queue and concurrency info
SYSTEM_STATUS=$(curl -sf "${DASHBOARD_URL}/api/pipelines/system-status" 2>/dev/null || echo "{}")

TOTAL_WORK=$PENDING_COUNT
if [ "$TOTAL_WORK" -eq 0 ]; then
  exit 0
fi

CURRENT_ACTIVE=$(active_slots)
AVAILABLE=$((MAX_CONCURRENT - CURRENT_ACTIVE))

if [ "$AVAILABLE" -le 0 ]; then
  log "All $MAX_CONCURRENT slots occupied, skipping ($TOTAL_WORK pending)"
  exit 0
fi

log "Found $TOTAL_WORK pending production(s), $AVAILABLE slot(s) available"

# Process pending productions up to available slots
LAUNCHED=0
echo "$PENDING" | jq -c '.[]' | while read -r item; do
  if [ "$LAUNCHED" -ge "$AVAILABLE" ]; then
    log "Slot limit reached ($MAX_CONCURRENT), remaining items will wait"
    break
  fi

  SLUG=$(echo "$item" | jq -r '.slug')
  PROD_ID=$(echo "$item" | jq -r '.productionId')
  TOPIC=$(echo "$item" | jq -r '.topic')

  # Skip if this specific production is already being processed
  if [ -f "$SLOT_DIR/slot-${SLUG}-${PROD_ID}" ]; then
    log "Already processing: $SLUG / $PROD_ID, skipping"
    continue
  fi

  log "Processing: $SLUG / $PROD_ID — $TOPIC (slot $((CURRENT_ACTIVE + LAUNCHED + 1))/$MAX_CONCURRENT)"

  (
    # Claim a slot
    echo $$ > "$SLOT_DIR/slot-${SLUG}-${PROD_ID}"
    trap 'rm -f "$SLOT_DIR/slot-${SLUG}-${PROD_ID}"' EXIT

    # Spawn Claude Code to handle this production as @content-strategist
    cd "$PROJECT_DIR" && claude -p "You are the @content-strategist agent. A pending production needs processing.

Channel: $SLUG
Production ID: $PROD_ID
Image Concept: $TOPIC

Your job:
1. Read the channel config: projects/$SLUG/config.json
2. Read the content plan: projects/$SLUG/output/$PROD_ID/content-plan.json (has duration, segment count)
3. Read all frameworks in projects/$SLUG/frameworks/
4. Read the Flux skill: .claude/agents/skills/flux-image-producer.md
5. Read the Runway skill: .claude/agents/skills/runway-animation-producer.md
6. Read rotation state from projects/$SLUG/rotation-state.json
7. Build imagePrompts[] — one per segment, using the image framework rotation sequence + image concept
8. Build animationPrompts[] — one per segment, from the animation framework confirmed library
9. musicPrompt is baked into config.json (config.musicPrompt) — pass it through unchanged
10. Generate title, description, tags, hashtags using the channel's title-formula.md and description-formula.md frameworks + the image concept + music prompt context
11. Start the pipeline by POSTing to $DASHBOARD_URL/api/channels/$SLUG/run/$PROD_ID with JSON body:
    {
      \"scriptOutput\": {
        \"title\": \"...\",
        \"description\": \"...\",
        \"tags\": [...],
        \"hashtags\": [...],
        \"script\": [{\"sectionName\": \"main\", \"narration\": \"\", \"imageCue\": \"$TOPIC\", \"durationSeconds\": 0}]
      },
      \"imagePrompts\": [...],
      \"animationPrompts\": [...],
      \"durationMinutes\": <from content plan>,
      \"segmentCount\": <from content plan>
    }

Use curl or Bash to POST. Music prompt comes from config — do not include it in the POST body.
Work autonomously. Do not ask for confirmation. Execute the full workflow." \
    --allowedTools "Read,Glob,Grep,Bash,Agent" \
    >> "$LOG_FILE" 2>&1

    RESULT=$?
    if [ $RESULT -eq 0 ]; then
      log "Completed: $SLUG / $PROD_ID"
    else
      log "Failed (exit $RESULT): $SLUG / $PROD_ID"
    fi
  ) &

  LAUNCHED=$((LAUNCHED + 1))
done

# Wait for all background CC sessions to finish
wait
log "Watcher cycle complete"
