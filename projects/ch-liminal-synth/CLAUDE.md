# Liminal Synth — Channel Operations File

## Channel Identity
- **Name:** Liminal Synth
- **Slug:** ch-liminal-synth
- **Format:** music-only
- **Niche:** Electronic Synth

---

## Scope Boundary
This subagent operates exclusively within `projects/ch-liminal-synth/`.
Do not read, write, or reference any other channel directory or root-level config.
All paths below are relative to this channel directory unless explicitly noted.

---

## Session Start
Ask the user for the following before doing anything else:
1. **Image concept** — visual direction for this session
2. **Video length** — duration in hours (e.g. 1, 4, 8)
3. **Segment count** — number of segments, or 0/none for one seamless video

Music prompt is locked in `frameworks/music-framework.md` — do not ask for music concept.

Segment duration is calculated automatically: (total minutes) ÷ (segment count).
Once all inputs are confirmed, calculate segment duration and proceed to Step 1.

---

## Framework Paths

| Framework | Path |
|-----------|------|
| Image framework | `frameworks/image-framework.md` |
| Animation framework | `frameworks/animation-framework.md` |
| Music framework | `frameworks/music-framework.md` |
| Title formula | `frameworks/title-formula.md` |
| Description & hashtags | `shared/description-formula.md` (project root) |

---

## Production Pipeline — Music Only Format

### Step 1 — Prompt Construction
Agent: `@content-strategist`

This is the core creative step. The agent reads all frameworks, checks rotation state, and builds the prompt arrays from the user's session inputs.

**Rotation state** (read first):
- Read `rotation-state.json` from channel dir (or `GET /api/channels/ch-liminal-synth/rotation-state`)
- `imageSlot`: the next Master Rotation Sequence slot to use (1-8, wraps)
- `lastEnvironment`: do not use this environment for the first segment
- `lastAtmosphere`: do not use this atmosphere condition for the first segment
- If no state file exists, start at slot 1 with no exclusions
- State advances automatically after successful compilation — do not manually update

**Image prompts** (one per segment):
- Read `.claude/agents/skills/flux-image-producer.md` in full
- Read `frameworks/image-framework.md` — rotation sequence, color palette, rendering rules
- Start at the `imageSlot` from rotation state
- For each segment: use the current slot's colors/camera/lens/subject/orientation, then advance to next slot
- Pick an environment that differs from `lastEnvironment` (and from the previous segment's environment)
- Pick an atmosphere that differs from `lastAtmosphere` (and from the previous segment's atmosphere)
- Output: `imagePrompts[]` — one fully constructed Flux prompt string per segment

**Animation prompts** (one per segment):
- Read `.claude/agents/skills/runway-animation-producer.md` in full
- Read `frameworks/animation-framework.md` — confirmed motion prompts, scene type selection table
- For each segment: determine the scene type from the image prompt (rooftop/street/tunnel/bridge/facade), select the matching confirmed prompt from the framework
- Do not write custom animation prompts — select from the confirmed library only
- Output: `animationPrompts[]` — one confirmed prompt string per segment

**Music prompt** (locked — same for every production):
- Read `frameworks/music-framework.md` — contains the locked prompt
- Use the exact locked prompt: `electronic, Drum Machine, Bass, Lush Synthesizer Pads, Synthesizer Arp, Synth Bass, Melancholic, Vibe, Cool, Modern, Atmospheric, well-arranged composition, 115 BPM`
- Do not modify based on session inputs — pass through unchanged
- Output: `musicPrompt` — this exact string for all segments

**Pass all to the pipeline:**
```json
{
  "imagePrompts": ["prompt for seg 0", "prompt for seg 1", ...],
  "musicPrompt": "single music prompt",
  "animationPrompts": ["prompt for seg 0", "prompt for seg 1", ...],
  "lastEnvironment": "environment used in final segment",
  "lastAtmosphere": "atmosphere used in final segment"
}
```

### Step 2 — Asset Generation
Agent: `@asset-producer`

Pipeline receives the prompt arrays and calls APIs. No prompt construction happens here — prompts are passed through unchanged.

For each segment, in order:

**a. Image Generation**
- Call Flux with `imagePrompts[i]` — prompt passed through unchanged
- Output: one image per segment (1280x720)

**b. Runway Animation**
- Pass each Flux image + `animationPrompts[i]` to Runway Gen-4 Turbo
- 10s duration, 1280x720, seed matches Flux session seed
- Output: one animated clip per segment

**c. Music Generation**
- Call Stable Audio 2.5 with `musicPrompt` — same prompt for all segments
- Max 190s per generation
- Output: one audio track per segment

### Step 3 — Telegram Checkpoint 1
Agent: `@channel-manager`
- Send sample previews — one animated clip and music sample per segment
- Wait for user response: `approve` / `regen` / `regen [notes]`
- On `regen`: redo flagged segments then re-send checkpoint
- On `approve`: proceed to Step 4

### Step 4 — Video Compilation
Agent: `@video-compiler`
- Compile 16:9 1080p (upscaled from 1280x720 source via lanczos)
- Each segment: animated clip looped to match track duration
- Transitions: 3.0s crossfade between segments (audio + video)
- Post-processing: vignette filter (PI/4)
- Output: single stitched video at full session duration

### Step 5 — Title, Description & Chapters
Agent: `@content-strategist`
- Read `frameworks/title-formula.md` → generate title
- Read `shared/description-formula.md` → generate description
- Generate chapter markers (timestamps per segment)
- Generate tags and hashtags
- Output: title, description, tags, hashtags

### Step 6 — Telegram Checkpoint 2
Agent: `@channel-manager`
- Send final compiled video preview, title, description, and tags via Telegram
- Wait for user response: `approve` then schedule time
- On approve + time received: proceed to Step 7

### Step 7 — Schedule & Post
Agent: `@channel-manager`
- Schedule video via YouTube Data API at provided time
- Confirm scheduled post back to user via Telegram

---

## What This Channel Does NOT Use
- No narration scripts — no `@script-writer` for script generation
- No voiceover — no ElevenLabs calls
- No thumbnails — no NB2/Gemini calls
- No teaser/shorts — no portrait images
- No production briefs — image/music/animation direction comes from frameworks + session inputs

---

## Credentials
- **YouTube OAuth:** `projects/ch-liminal-synth/.youtube-oauth.json`
