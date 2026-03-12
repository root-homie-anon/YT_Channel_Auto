# Strange Universe — Channel Operations File

## Channel Identity
- **Name:** Strange Universe
- **Slug:** ch-strange-universe
- **Format:** long+short
- **Niche:** UFOs

---

## Scope Boundary
This subagent operates exclusively within `projects/ch-strange-universe/`.
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

### PART 1 — Long Video Production

### Step 1 — Script Generation
Agent: `@script-writer`
- Read `frameworks/script-formula.md`
- Generate full long-form script for the user-provided topic
- Output: structured script with clearly labeled sections

### Step 2 — Image Cue Extraction
Agent: `@content-strategist`
- Read script sequentially section by section
- Extract one visual cue per section
- Map image prompts to script timeline
- Output: ordered image prompt list tied to script sections

### Step 3 — Asset Generation (Long)
Agent: `@asset-producer`
Run in this order:
1. **Images** — call Flux for each prompt using `frameworks/image-framework.md`
2. **Voice Over** — call ElevenLabs with full script using voice ID `EiNlNiXeDU1pqqOPrYMO`
3. **Music** — call Sonauto for one fresh background track using `frameworks/music-framework.md`

---

### PART 2 — Short Derivation (runs after Step 3, before Checkpoint 1)

### Step 4 — Teaser Script Generation
Agent: `@script-writer`
- Read `frameworks/teaser-formula.md`
- Use long script as input
- Goal: hook + build intrigue + drive viewers to full video
- Not a summary — a setup that leaves them wanting more
- Output: teaser script

### Step 5 — Asset Generation (Short)
Agent: `@asset-producer`
1. **Voice Over** — new VO recording using teaser script, same voice ID `EiNlNiXeDU1pqqOPrYMO`
2. **Images** — reuse images from Step 3 (reframe for 9:16 as needed)
3. **Music** — trim and reuse music track generated in Step 3

---

### Step 6 — Telegram Checkpoint 1
Agent: `@channel-manager`
- Send asset summary and sample previews for both long and short via Telegram
- Wait for user response: `approve` / `regen` / `regen [notes]`
- On `regen`: redo flagged assets then re-send checkpoint
- On `approve`: proceed to Step 7

### Step 7 — Video Compilation (Long)
Agent: `@video-compiler`
- Compile 16:9 1080p
- Ken Burns motion, crossfade transitions
- Image timing driven by VO section breaks
- Audio: music underneath, VO on top
- Output: compiled long video file

### Step 8 — Video Compilation (Short)
Agent: `@video-compiler`
- Compile 9:16 vertical
- Same Ken Burns + crossfade treatment
- New teaser VO, trimmed music
- Output: compiled short video file

### Step 9 — Thumbnail Generation (Both)
Agent: `@video-compiler`
- Read `frameworks/thumbnail-formula.md`
- Generate thumbnail for long (16:9 optimized)
- Generate thumbnail for short (9:16 optimized)
- Output: two thumbnail files

### Step 10 — Title, Description & Tags (Both)
Agent: `@script-writer`
- Read `frameworks/title-formula.md` → generate titles for long and short separately
- Read `shared/description-formula.md` → generate descriptions and hashtags for both
- Output: title, description, tags for long + title, description, tags for short

### Step 11 — Telegram Checkpoint 2
Agent: `@channel-manager`
- Send both compiled videos, thumbnails, titles, descriptions, and tags via Telegram
- Wait for user to approve both and provide two schedule times
- Long posts first, short follows
- On approve + both times received: proceed to Step 12

### Step 12 — Schedule & Post (Both)
Agent: `@channel-manager`
- Schedule long video via YouTube Data API at first provided time
- Schedule short video via YouTube Data API at second provided time
- Confirm both scheduled posts back to user via Telegram

---

## Credentials
- **YouTube OAuth:** `projects/ch-strange-universe/.youtube-oauth.json`
- **ElevenLabs Voice ID:** `EiNlNiXeDU1pqqOPrYMO`
