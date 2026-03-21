# {{CHANNEL_NAME}} — Channel Operations File

## Channel Identity
- **Name:** {{CHANNEL_NAME}}
- **Slug:** {{CHANNEL_SLUG}}
- **Format:** short
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

---

## Framework Paths

| Framework | Path |
|-----------|------|
| Script formula | `frameworks/script-formula.md` |
| Image framework | `frameworks/image-framework.md` |
| Music framework | `frameworks/music-framework.md` |
| Thumbnail formula | `frameworks/thumbnail-formula.md` |
| Title formula | `frameworks/title-formula.md` |
| Description & hashtags | `shared/description-formula.md` (project root) |

---

## Production Pipeline — Short Format

### Step 1 — Script & Metadata Generation
Agent: `@content-strategist`
- Read `frameworks/script-formula.md` and all other frameworks
- Generate short-form script (hook-driven, punchy, designed for vertical viewing)
- Extract image cues per section
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

### Step 4 — Video Compilation
Pipeline code — 9:16 vertical, Ken Burns motion, crossfade, VO-timed images.

### Step 5 — Thumbnail Generation
Pipeline code — NBPro (Gemini) generates thumbnail using `thumbnailDirection` from production brief.

### Step 6 — Telegram Checkpoint 2
Pipeline code — Telegram bot sends final video, thumbnail, title, description.
- Wait for user response: `approve` then schedule time.

### Step 7 — Schedule & Post
Pipeline code — YouTube Data API upload, unlisted until approval, then scheduled publish.

---

## Credentials
- **YouTube OAuth:** `{{YOUTUBE_OAUTH_PATH}}`
- **ElevenLabs Voice ID:** `{{ELEVENLABS_VOICE_ID}}`
