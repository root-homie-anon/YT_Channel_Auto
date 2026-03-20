#!/usr/bin/env bash
# Retry thumbnail generation for productions missing thumbnails.
# Designed to run as a cron every 10 minutes until thumbnails are generated.
# Crontab: */10 * * * * /home/claude-dev/projects/YT_Channel_Auto/scripts/retry-thumbnail.sh

set -euo pipefail

PROJECT_DIR="/home/claude-dev/projects/YT_Channel_Auto"
LOG_FILE="${PROJECT_DIR}/logs/thumbnail-retry.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

cd "$PROJECT_DIR"

# Find completed productions without thumbnails
for channel_dir in projects/ch-*/; do
  slug=$(basename "$channel_dir")
  output_dir="${channel_dir}output"
  [ -d "$output_dir" ] || continue

  # Check config — skip music-only channels (no thumbnails)
  format=$(python3 -c "import json; print(json.load(open('${channel_dir}config.json'))['channel']['format'])" 2>/dev/null || echo "unknown")
  [ "$format" = "music-only" ] && continue

  for prod_dir in "$output_dir"/*/; do
    [ -d "$prod_dir" ] || continue
    status_file="${prod_dir}pipeline-status.json"
    [ -f "$status_file" ] || continue

    stage=$(python3 -c "import json; print(json.load(open('$status_file'))['stage'])" 2>/dev/null || echo "unknown")
    [ "$stage" = "complete" ] || continue

    # Check if thumbnail exists
    if [ -f "${prod_dir}thumbnail.png" ] || [ -f "${prod_dir}thumbnail.jpg" ]; then
      continue
    fi

    prod_id=$(basename "$prod_dir")
    title=$(python3 -c "import json; print(json.load(open('${prod_dir}script-output.json')).get('title', '$prod_id'))" 2>/dev/null || echo "$prod_id")

    log "Missing thumbnail: $slug / $title — attempting generation"

    if npx tsx scripts/gen-thumbnail.ts "$prod_dir" >> "$LOG_FILE" 2>&1; then
      log "Thumbnail generated for: $title"

      # Compress to JPG for YouTube upload (2MB limit)
      if [ -f "${prod_dir}thumbnail.png" ]; then
        ffmpeg -y -i "${prod_dir}thumbnail.png" -q:v 4 "${prod_dir}thumbnail.jpg" >> "$LOG_FILE" 2>&1
        log "Compressed to JPG"
      fi

      # Upload to YouTube if publish-result exists
      publish_file="${prod_dir}publish-result.json"
      if [ -f "$publish_file" ]; then
        video_id=$(python3 -c "import json; print(json.load(open('$publish_file')).get('youtubeVideoId', ''))" 2>/dev/null)
        if [ -n "$video_id" ]; then
          thumb_path="${prod_dir}thumbnail.jpg"
          [ -f "$thumb_path" ] || thumb_path="${prod_dir}thumbnail.png"
          log "Uploading thumbnail to YouTube video $video_id"
          npx tsx -e "
import 'dotenv/config';
import { setThumbnail } from './src/services/youtube-service.ts';
async function main() {
  await setThumbnail('projects/${slug}/.youtube-oauth.json', '${video_id}', '${thumb_path}');
  console.log('Thumbnail uploaded to YouTube');
}
main().catch(e => { console.error(e.message); process.exit(1); });
" >> "$LOG_FILE" 2>&1 && log "Thumbnail uploaded to YouTube for: $title" || log "YouTube thumbnail upload failed for: $title"
        fi
      fi
    else
      log "Thumbnail gen failed for: $title (Gemini likely still down)"
    fi
  done
done

log "Thumbnail retry cycle complete"
