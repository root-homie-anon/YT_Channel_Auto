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

    # Detect channel format
    CHANNEL_FORMAT=$(python3 -c "import json; print(json.load(open('$PROJECT_DIR/projects/$SLUG/config.json'))['channel']['format'])" 2>/dev/null || echo "unknown")

    if [ "$CHANNEL_FORMAT" = "music-only" ]; then
      AGENT_PROMPT="You are the @content-strategist agent. A pending music-only production needs processing.

Channel: $SLUG
Production ID: $PROD_ID
Image Concept: $TOPIC

Execute these phases IN ORDER. Do not skip steps. Save artifacts between phases for crash recovery.

═══ PHASE 1 — READ CONTEXT ═══
1. Read channel config: projects/$SLUG/config.json
2. Read content plan: projects/$SLUG/output/$PROD_ID/content-plan.json (has duration, segment count)
3. Read ALL frameworks in projects/$SLUG/frameworks/ (image, animation, music, title-formula, description-formula)
4. Read the channel's description formula from the frameworks path in config.json (e.g. frameworks/description-formula.md)
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
Work autonomously. Do not ask for confirmation. Execute the full workflow."

    else
      # Narrated channel (long, short, long+short)
      AGENT_PROMPT="You are the @content-strategist agent. A pending narrated production needs processing.

Channel: $SLUG
Production ID: $PROD_ID
Topic: $TOPIC

The user provided this topic as a starting point — it describes WHAT the video is about, NOT the final title.
The final title MUST be generated using the channel's title-formula.md framework.

Execute these phases IN ORDER. Do not skip steps.

═══ PHASE 1 — READ CONTEXT ═══
1. Read channel config: projects/$SLUG/config.json
2. Read channel CLAUDE.md: projects/$SLUG/CLAUDE.md
3. Read ALL frameworks in projects/$SLUG/frameworks/:
   - script-formula.md
   - image-framework.md
   - music-framework.md
   - thumbnail-formula.md
   - title-formula.md
   - teaser-formula.md (if exists)
4. Read the channel's description formula from the frameworks path in config.json (e.g. frameworks/description-formula.md)

═══ PHASE 2 — GENERATE SCRIPT ═══
5. Using script-formula.md, write a full narrated script for the topic: \"$TOPIC\"
6. Structure the script as an array of sections, each with:
   { \"sectionName\": \"<name>\", \"narration\": \"<full narration text>\", \"imageCue\": \"<visual description for this section>\", \"durationSeconds\": 0 }
7. The script should be 15-22 minutes when read aloud at natural pace

═══ PHASE 2b — GENERATE TEASER SCRIPT (long+short channels only) ═══
7b. Check config.json format — if it is \"long+short\":
   - Read teaser-formula.md
   - Using the LONG script from step 5 as input, write a 60-90 second teaser script
   - The teaser is NOT a summary — it's a hook that builds intrigue and drives viewers to the full video
   - Structure as an array of 3-5 sections, same format as step 6
   - Total narration should be ~150-250 words (60-90 seconds when read aloud)
   - This will be compiled as a YouTube Short (9:16 vertical)

═══ PHASE 3 — GENERATE PRODUCTION BRIEF ═══
8. Based on the script content, generate a productionBrief object:
   {
     \"topic\": \"$TOPIC\",
     \"thumbnailDirection\": {
       \"pillar\": \"<surveillance | archaeological | technical>\",
       \"flavor\": \"<VHS | CCTV | NVG | aged photograph | blueprint — per pillar>\",
       \"nbproPrompt\": \"<COMPLETE ready-to-send NBPro prompt — see step 8b>\"
     },
     \"titleDirection\": {
       \"coreHookPhrase\": \"<strongest 3-5 word phrase from the script>\",
       \"primaryKeyword\": \"<highest-value search term>\",
       \"supportingKeywords\": [\"keyword2\", \"keyword3\"],
       \"emotionalTarget\": \"<what the title should make viewer feel>\"
     }
   }

8b. BUILD THE nbproPrompt — this is critical:
   - Read thumbnail-formula.md — identify which pillar matches this video's content
   - Select the correct pillar template (Surveillance / Archaeological / Technical)
   - If Surveillance, pick the flavor (VHS / CCTV / NVG) that best fits the topic
   - Fill in ALL template variables:
     * [SUBJECT] — specific, grounded visual description from the script (not abstract)
     * [FLAVOR] and [FLAVOR ARTIFACTS] — from the flavor tokens table (Surveillance only)
     * [STAMP WORD] — from that pillar's approved word bank
     * [2-3 CONTEXT WORDS] — lowercase curiosity hook relevant to this specific video
   - The output must be the COMPLETE filled-in template — no placeholders, no variables
   - Include the \"16:9 aspect ratio, 4K resolution.\" line at the end
   - This prompt goes directly to Gemini image generation — it must stand alone

═══ PHASE 4 — GENERATE TITLE ═══
9. Read title-formula.md — generate 4-5 title candidates following the formula EXACTLY
10. Each candidate must use a different structural pattern from the formula
11. Each candidate must be evaluated against the thumbnail concept (pairing principle)
12. Select the strongest candidate
13. Write locked title to projects/$SLUG/output/$PROD_ID/locked-title.json:
    { \"title\": \"...\", \"candidateNumber\": N, \"reason\": \"...\" }

═══ PHASE 5 — GENERATE DESCRIPTION & HASHTAGS ═══
14. Read the channel's description formula from the frameworks path in config.json
15. Generate description, tags (15-20 search terms), and hashtags following the formula

═══ PHASE 6 — START PIPELINE ═══
16. POST to $DASHBOARD_URL/api/channels/$SLUG/run/$PROD_ID with JSON body:
    {
      \"scriptOutput\": {
        \"title\": \"<locked title from step 13>\",
        \"description\": \"<generated description>\",
        \"tags\": [...],
        \"hashtags\": [...],
        \"script\": [<sections from step 6>],
        \"teaserScript\": [<teaser sections from step 7b — ONLY if long+short format, omit otherwise>],
        \"productionBrief\": <brief from step 8>
      }
    }

CRITICAL RULES:
- The topic '$TOPIC' is NOT the title. Generate the title using title-formula.md.
- The productionBrief.thumbnailDirection is REQUIRED — without it, no thumbnail gets generated.
- For long+short channels: teaserScript is REQUIRED — without it, no YouTube Short gets produced.
  The teaser must be 60-90 seconds (150-250 words), NOT the full 15-minute script.
- Music prompt is baked into config.json — do not generate or override it.
- Read the channel's own description-formula.md (from frameworks path in config.json), NOT the shared one.
- Work autonomously. Do not ask for confirmation. Execute the full workflow."
    fi

    cd "$PROJECT_DIR" && claude -p "$AGENT_PROMPT" \
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
