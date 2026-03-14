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
    cd "$PROJECT_DIR" && claude -p "You are the @content-strategist agent. A pending music-only production needs processing.

Channel: $SLUG
Production ID: $PROD_ID
Image Concept: $TOPIC

Execute these phases IN ORDER. Do not skip steps. Save artifacts between phases for crash recovery.

═══ PHASE 1 — READ CONTEXT ═══
1. Read channel config: projects/$SLUG/config.json
2. Read content plan: projects/$SLUG/output/$PROD_ID/content-plan.json (has duration, segment count)
3. Read ALL frameworks in projects/$SLUG/frameworks/ (image, animation, music, title-formula, description-formula)
4. Read the shared description formula: shared/description-formula.md
5. Read the Flux skill: .claude/agents/skills/flux-image-producer.md
6. Read the Runway skill: .claude/agents/skills/runway-animation-producer.md
7. Read rotation state: projects/$SLUG/rotation-state.json
8. Read description state: projects/$SLUG/description-state.json (for rotation tracking — if missing, start fresh)

═══ PHASE 2 — BUILD PROMPTS ═══
9. Build imagePrompts[] — one per segment, using image framework rotation sequence + image concept
10. Build animationPrompts[] — one per segment, from animation framework confirmed library
11. musicPrompt is baked into config.json (config.musicPrompt) — pass through unchanged

═══ PHASE 3 — SAVE PRODUCTION CONTEXT ═══
12. Write projects/$SLUG/output/$PROD_ID/production-context.json capturing:
    {
      \"visualContext\": {
        \"primaryEnvironment\": \"<environment used in image prompts>\",
        \"colorPalette\": \"<colors from the image framework slot>\",
        \"visualMood\": \"<mood/atmosphere of the visual world>\",
        \"atmosphericCondition\": \"<weather/atmosphere used>\"
      },
      \"musicContext\": {
        \"genre\": \"<genre descriptors from music prompt>\",
        \"instrumentation\": \"<instruments from music prompt>\",
        \"mood\": \"<mood descriptors from music prompt>\",
        \"energyArc\": \"<energy description>\"
      },
      \"sessionSeed\": {
        \"imageConcept\": \"$TOPIC\",
        \"segmentCount\": <from content plan>,
        \"totalDuration\": \"<human readable duration>\"
      }
    }

═══ PHASE 4 — GENERATE TITLE (must complete before Phase 5) ═══
13. Read title-formula.md — generate 4 title candidates following the formula exactly
14. Select the strongest candidate (your recommendation)
15. Write the locked title to projects/$SLUG/output/$PROD_ID/locked-title.json:
    { \"title\": \"...\", \"candidateNumber\": N, \"reason\": \"...\" }

═══ PHASE 5 — GENERATE DESCRIPTION (requires locked title + production context) ═══
16. Read description-formula.md (shared or channel-specific from config.frameworks.description)
17. Read the locked title from locked-title.json
18. Read production-context.json for MUSIC_CONTEXT and VISUAL_CONTEXT
19. Read description-state.json — note last-used openers, tags, descriptors to AVOID repeating
20. Generate the full description following the formula block-by-block:
    - Block 1: Use a DIFFERENT Block1 opener number than lastBlock1Opener
    - Block 2: Use a DIFFERENT Block2 opener number than lastBlock2Opener
    - Block 10 hashtags: Pick DIFFERENT genre/function/vibe tags than last time
    - Block 7 metadata: Pick DIFFERENT mood/style descriptors than last time
    - Block 8 tool credits: Include ONLY if config.toolCredits is true
    - Block 9 CTA: Pull from config.cta — skip if empty
21. Generate tags[] (YouTube tags, not hashtags — 15-20 relevant search terms)
22. Extract hashtags[] from your Block 10 output
23. Update description-state.json with what you used:
    Write to projects/$SLUG/description-state.json:
    {
      \"lastBlock1Opener\": <number used>,
      \"lastBlock2Opener\": <number used>,
      \"lastGenreTags\": [\"#tag1\", \"#tag2\"],
      \"lastFunctionTags\": [\"#tag1\", \"#tag2\"],
      \"lastVibeTags\": [\"#tag1\", \"#tag2\"],
      \"lastMoodDescriptors\": [\"Focused\", \"Hypnotic\"],
      \"lastStyleDescriptors\": [\"Downtempo\", \"Deep Bass\"],
      \"updatedAt\": \"<ISO timestamp>\",
      \"lastProductionId\": \"$PROD_ID\"
    }

═══ PHASE 6 — START PIPELINE ═══
24. POST to $DASHBOARD_URL/api/channels/$SLUG/run/$PROD_ID with JSON body:
    {
      \"scriptOutput\": {
        \"title\": \"<locked title>\",
        \"description\": \"<full generated description>\",
        \"tags\": [...],
        \"hashtags\": [...],
        \"script\": [{\"sectionName\": \"main\", \"narration\": \"\", \"imageCue\": \"$TOPIC\", \"durationSeconds\": 0}]
      },
      \"imagePrompts\": [...],
      \"animationPrompts\": [...],
      \"durationMinutes\": <from content plan>,
      \"segmentCount\": <from content plan>
    }

Music prompt comes from config — do not include it in the POST body.
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
