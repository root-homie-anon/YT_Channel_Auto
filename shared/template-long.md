# {{CHANNEL_NAME}} — Channel Operations File

## Channel Identity
- **Name:** {{CHANNEL_NAME}}
- **Slug:** {{CHANNEL_SLUG}}
- **Format:** long
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
All creative frameworks are in `frameworks/`. Read the relevant file before each production step.

| Framework | Path |
|-----------|------|
| Script formula | `frameworks/script-formula.md` |
| Image framework | `frameworks/image-framework.md` |
| Music framework | `frameworks/music-framework.md` |
| Thumbnail formula | `frameworks/thumbnail-formula.md` |
| Title formula | `frameworks/title-formula.md` |
| Description & hashtags | `shared/description-formula.md` (project root) |

---

## Production Pipeline — Long Format

### Step 1 — Script Generation
Agent: `@script-writer`
- Read `frameworks/script-formula.md`
- Generate full long-form script for the user-provided topic
- Output: structured script with clearly labeled sections

### Step 2 — Image Cue Extraction
Agent: `@content-strategist`
- Read script sequentially section by section
- Extract one visual context cue per section
- Map image prompts to script timeline
- Output: ordered list of image prompts tied to script sections

### Step 3 — Asset Generation
Agent: `@asset-producer`
Run in this order:
1. **Images** — call Flux for each image prompt using `frameworks/image-framework.md`
2. **Voice Over** — call ElevenLabs with full script using voice ID `{{ELEVENLABS_VOICE_ID}}`
3. **Music** — generate one fresh background track using `frameworks/music-framework.md`

### Step 4 — Telegram Checkpoint 1
Agent: `@channel-manager`
- Send asset summary and sample previews via Telegram
- Wait for user response: `approve` / `regen` / `regen [notes]`
- On `regen`: redo flagged assets then re-send checkpoint
- On `approve`: proceed to Step 5

### Step 5 — Video Compilation
Agent: `@video-compiler`
- Read `frameworks/image-framework.md` for any visual style notes
- Compile 16:9 1080p video
- Images: Ken Burns motion (subtle scale/pan)
- Transitions: crossfade between images
- Image timing: driven by VO section breaks
- Audio: music layer underneath, VO on top
- Output: compiled video file

### Step 6 — Thumbnail Generation
Agent: `@video-compiler`
- Read `frameworks/thumbnail-formula.md`
- Select most visually striking image from Step 3
- Generate thumbnail-optimized version per formula
- Output: thumbnail image file

### Step 7 — Title, Description & Tags
Agent: `@script-writer`
- Read `frameworks/title-formula.md` → generate title
- Read `shared/description-formula.md` → generate description with chapter markers and CTAs
- Generate tags and hashtags per description formula
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
