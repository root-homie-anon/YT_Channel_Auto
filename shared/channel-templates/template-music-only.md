# {{CHANNEL_NAME}} — Channel Operations File

## Channel Identity
- **Name:** {{CHANNEL_NAME}}
- **Slug:** {{CHANNEL_SLUG}}
- **Format:** music-only
- **Niche:** {{CHANNEL_NICHE}}

---

## Scope Boundary
This subagent operates exclusively within `projects/{{CHANNEL_SLUG}}/`.
Do not read, write, or reference any other channel directory or root-level config.
All paths below are relative to this channel directory unless explicitly noted.

---

## Session Start
Ask the user for the following before doing anything else:
1. **Image concept** — visual direction for this session
2. **Music concept** — sonic direction for this session
3. **Video length** — duration in hours (e.g. 1, 4, 8)
4. **Segment count** — number of segments, or 0/none for one seamless video

Segment duration is calculated automatically: (total minutes) ÷ (segment count).
Once all inputs are confirmed, calculate segment duration and begin the pipeline.

---

## Framework Paths

| Framework | Path |
|-----------|------|
| Image framework | `frameworks/image-framework.md` |
| Music framework | `frameworks/music-framework.md` |
| Thumbnail formula | `frameworks/thumbnail-formula.md` |
| Title formula | `frameworks/title-formula.md` |
| Description & hashtags | `shared/description-formula.md` (project root) |

---

## Production Pipeline — Music Only Format

### Step 1 — Segment Calculation
Agent: `@content-strategist`
- Calculate segment duration: total minutes ÷ segment count
- If no segments: treat entire video as one segment
- Generate segment labels (Segment 1, Segment 2, etc.)
- Output: segment plan with duration per segment

### Step 2 — Per-Segment Generation (repeat for each segment)
Agent: `@asset-producer`

For each segment, in order:

**a. Image Generation**
- Read `frameworks/image-framework.md`
- Apply session image concept
- Call Flux for one image per segment
- Output: one image per segment

**b. Runway ML Animation**
- Pass each image through Runway ML Gen-4 Turbo photo-to-video
- Subtle animation, loop-friendly
- No Ken Burns — Runway ML animation is the motion
- Output: one short animated clip per segment

**c. Music Generation**
- Read `frameworks/music-framework.md`
- Apply session music concept
- Generate one track per segment matching segment duration
- Output: one audio track per segment

### Step 3 — Telegram Checkpoint 1
Agent: `@channel-manager`
- Send sample previews — one animated clip and music sample per segment
- Wait for user response: `approve` / `regen` / `regen [notes]`
- On `regen`: redo flagged segments then re-send checkpoint
- On `approve`: proceed to Step 4

### Step 4 — Video Compilation
Agent: `@video-compiler`
- Compile 16:9 1080p
- Each segment: animated clip looped to match track duration
- Transitions: crossfade between segments (audio + video)
- Output: single stitched video at full session duration

### Step 5 — Thumbnail Generation
Agent: `@video-compiler`
- Read `frameworks/thumbnail-formula.md`
- Select strongest image from Step 2
- Music-only style: visual-focused, minimal or no text overlay per formula
- Output: thumbnail image file

### Step 6 — Title, Description & Tags
Agent: `@script-writer`
- Read `frameworks/title-formula.md` → generate title
- Read `shared/description-formula.md` → generate description
- Include chapter markers per segment in description
- Generate hashtags per description formula
- Output: title, description, tags as separate fields

### Step 7 — Telegram Checkpoint 2
Agent: `@channel-manager`
- Send final compiled video, thumbnail, title, description, and tags via Telegram
- Wait for user response: `approve` then schedule time
- On approve + time received: proceed to Step 8

### Step 8 — Schedule & Post
Agent: `@channel-manager`
- Schedule video via YouTube Data API at provided time
- Confirm scheduled post back to user via Telegram

---

## Credentials
- **YouTube OAuth:** `{{YOUTUBE_OAUTH_PATH}}`
