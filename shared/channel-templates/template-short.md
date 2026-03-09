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

### Step 1 — Script Generation
Agent: `@script-writer`
- Read `frameworks/script-formula.md`
- Generate short-form script for the user-provided topic
- Short format: hook-driven, punchy, designed for vertical viewing
- Output: structured short script

### Step 2 — Image Cue Extraction
Agent: `@content-strategist`
- Read script sequentially
- Extract one visual cue per section
- Output: ordered image prompt list tied to script

### Step 3 — Asset Generation
Agent: `@asset-producer`
Run in this order:
1. **Images** — call Flux for each prompt using `frameworks/image-framework.md`
2. **Voice Over** — call ElevenLabs with full script using voice ID `{{ELEVENLABS_VOICE_ID}}`
3. **Music** — call Sonauto for one fresh track using `frameworks/music-framework.md`

### Step 4 — Telegram Checkpoint 1
Agent: `@channel-manager`
- Send asset summary and sample previews via Telegram
- Wait for user response: `approve` / `regen` / `regen [notes]`
- On `regen`: redo flagged assets then re-send checkpoint
- On `approve`: proceed to Step 5

### Step 5 — Video Compilation
Agent: `@video-compiler`
- Compile 9:16 vertical format
- Images: Ken Burns motion (subtle scale/pan)
- Transitions: crossfade between images
- Image timing: driven by VO section breaks
- Audio: music layer underneath, VO on top
- Output: compiled short video file

### Step 6 — Thumbnail Generation
Agent: `@video-compiler`
- Read `frameworks/thumbnail-formula.md`
- Select strongest image from Step 3
- Generate thumbnail optimized for short format
- Output: thumbnail image file

### Step 7 — Title, Description & Tags
Agent: `@script-writer`
- Read `frameworks/title-formula.md` → generate title
- Read `shared/description-formula.md` → generate description and hashtags
- Output: title, description, tags as separate fields

### Step 8 — Telegram Checkpoint 2
Agent: `@channel-manager`
- Send final compiled video, thumbnail, title, description, and tags via Telegram
- Wait for user response: `approve` then schedule time
- On approve + time received: proceed to Step 9

### Step 9 — Schedule & Post
Agent: `@channel-manager`
- Schedule video via YouTube Data API using provided time
- Confirm scheduled post back to user via Telegram

---

## Credentials
- **YouTube OAuth:** `{{YOUTUBE_OAUTH_PATH}}`
- **ElevenLabs Voice ID:** `{{ELEVENLABS_VOICE_ID}}`
