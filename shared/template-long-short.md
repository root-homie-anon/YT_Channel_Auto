# {{CHANNEL_NAME}} — Channel Operations File

## Channel Identity
- **Name:** {{CHANNEL_NAME}}
- **Slug:** {{CHANNEL_SLUG}}
- **Format:** long+short
- **Niche:** {{CHANNEL_NICHE}}

---

## Scope Boundary
This subagent operates exclusively within `projects/{{CHANNEL_SLUG}}/`.
Do not read, write, or reference any other channel directory or root-level config.
All paths below are relative to this channel directory unless explicitly noted.

---

## Session Start
Ask the user for the video topic before doing anything else.
Once topic is confirmed, begin the pipeline in order. Do not skip steps.
Both long and short videos are produced in every session. The short derives from the long.

---

## Framework Paths

| Framework | Path |
|-----------|------|
| Script formula | `frameworks/script-formula.md` |
| Teaser formula | `frameworks/teaser-formula.md` |
| Image framework | `frameworks/image-framework.md` |
| Music framework | `frameworks/music-framework.md` |
| Thumbnail formula | `frameworks/thumbnail-formula.md` |
| Title formula | `frameworks/title-formula.md` |
| Description & hashtags | `shared/description-formula.md` (project root) |

---

## Production Pipeline — Long + Short Format

---

### Step 1 — Script & Metadata Generation
Agent: `@content-strategist`
- Read `frameworks/script-formula.md` and all other frameworks
- Generate full long-form script and teaser script (for long+short)
- Extract image cues per section, map to script timeline
- Generate production brief (thumbnail direction, title direction)
- Generate title, description, hashtags
- POST to pipeline API to trigger asset production

### Step 2 — Asset Generation
Pipeline code (`src/services/pipeline.ts`):
1. **Images** — Flux for each image prompt
2. **Voice Over** — ElevenLabs using voice ID `{{ELEVENLABS_VOICE_ID}}`
3. **Music** — Stable Audio

### Step 3 — Telegram Checkpoint 1
Pipeline code — Telegram bot sends asset summary and sample previews.
- Wait for user response: `approve` / `regen` / `regen [notes]`

### Step 4 — Video Compilation (Long + Short)
Pipeline code — 16:9 long + 9:16 short with teaser VO and trimmed music.

### Step 5 — Thumbnail Generation
Pipeline code — NBPro (Gemini) generates thumbnail using `thumbnailDirection` from production brief.

### Step 6 — Telegram Checkpoint 2
Pipeline code — Telegram bot sends both videos, thumbnails, titles, descriptions.
- Wait for user to approve and provide schedule times.

### Step 7 — Schedule & Post
Pipeline code — YouTube Data API upload, unlisted until approval, then scheduled publish.

---

## Credentials
- **YouTube OAuth:** `{{YOUTUBE_OAUTH_PATH}}`
- **ElevenLabs Voice ID:** `{{ELEVENLABS_VOICE_ID}}`
