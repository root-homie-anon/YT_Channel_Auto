# 1. ARCHITECTURE.md
# YouTube Automation System — Source of Truth
> This document is the canonical reference for the youtube-automation project.
> It replaces all previous brainstorm files. Update this document as decisions are finalized.
> Prefix "1." distinguishes this as a session-carry reference document.

---

## System Overview

Two completely independent systems. They do not share code, data, or agents.

| System | Purpose | Trigger |
|--------|---------|---------|
| `youtube-automation` | Multi-channel video production and posting pipeline | On-demand per channel session |
| `youtube-niche-researcher` | Standalone niche analysis and market research | On-demand, separate CC session |

This document covers **`youtube-automation` only**.

---

## Project Structure Concept

```
youtube-automation/
├── 1.ARCHITECTURE.md            ← this file (remove prefix before gh push)
├── CLAUDE.md                    ← master project file, agent factory hook
├── shared/                      ← shared utilities across all channels
│   ├── elevenlabs.ts            ← VO generation
│   ├── sonauto.ts               ← music generation
│   ├── flux.ts                  ← image generation (body images)
│   ├── nanobana.ts              ← thumbnail generation via NB2 (Gemini)
│   ├── kling.ts                 ← photo-to-video animation
│   ├── youtube.ts               ← upload + scheduling
│   ├── telegram.ts              ← approval bot
│   ├── ffmpeg.ts                ← video compilation
│   ├── config.ts                ← env/config loader
│   └── description-formula.md  ← shared description + hashtag formula (all channels)
├── .claude/
│   └── agents/                  ← shared agents, same across all channels
│       ├── content-strategist.md
│       ├── script-writer.md
│       ├── asset-producer.md
│       ├── video-compiler.md
│       └── channel-manager.md
└── projects/
    └── ch1-[channel-name]/
        ├── CLAUDE.md            ← channel-specific config + overrides
        ├── config.json          ← keys, voice ID, niche, format, frameworks
        └── frameworks/
            ├── script-formula.md       ← script structure + production brief output
            ├── teaser-formula.md       ← Mode A (derived) + Mode B (standalone)
            ├── title-formula.md        ← title candidates + pairing principle
            ├── thumbnail-formula.md    ← NB2 prompt construction + channel visual identity
            ├── image-framework.md      ← Flux image style + prompt framework
            └── music-framework.md      ← Sonauto music style framework
```

**Key principle:** Agents are defined once at the root level and shared across all channel projects. Channel config drives agent behavior — agents read `config.json` and `frameworks/` from the active channel directory at runtime.

---

## Channel Initialization Flow

When starting a new channel project the system prompts the user for:

1. **Channel name** — becomes the folder name under `projects/`
2. **Format** — one of: `long` / `short` / `long+short` / `music-only`
3. **Access credentials:**
   - YouTube account credentials / OAuth for this channel
   - ElevenLabs voice ID for this channel
   - Any channel-specific API key overrides (most keys are shared)
4. **Channel framework config:**
   - Niche/topic description
   - Target audience
   - Voice and tone
   - Content rules / constraints
   - Default target video length
   - Script structure preference
   - Image style framework
   - Music style framework
   - Thumbnail visual identity (color palette, style, faceless strategy)
   - Title style preferences
   - Fixed hashtags (exactly 2)
   - CTA lines and links for descriptions

The system generates the channel folder, `CLAUDE.md`, `config.json`, and all `frameworks/` files automatically from these inputs. No manual file creation required.

---

## Framework Files

All framework files live in `projects/ch-[name]/frameworks/` except `description-formula.md` which is shared.

| File | Scope | Purpose |
|------|-------|---------|
| `script-formula.md` | Per-channel | Long-form script structure, research phase, production brief output |
| `teaser-formula.md` | Per-channel | Mode A (derived teaser) + Mode B (standalone short) |
| `title-formula.md` | Per-channel | Title candidates, structural patterns, thumbnail pairing principle |
| `thumbnail-formula.md` | Per-channel | NB2 prompt construction, channel visual identity, design rules |
| `image-framework.md` | Per-channel | Flux body image style, prompt framework, visual language |
| `music-framework.md` | Per-channel | Sonauto style, mood, instrumentation direction |
| `description-formula.md` | Shared | Description structure, chapter markers, CTA block, hashtag rules |

---

## Script Writer Output — Two Documents Per Session

Every script session produces two documents that all downstream agents reference:

### 1. `script.md`
Full narrated script with embedded image cue markers at every section break.
Format: `[IMAGE CUE: description]` — extracted by `@content-strategist`, passed to `@asset-producer`.

### 2. `production-brief.md`
The single creative reference document for all downstream agents. Generated from research findings and the finalized script in the same pass. Contains:

- **Research findings** — facts, stats, examples, hook material, audience language
- **Image direction** — primary/supporting/avoid, visual mood, color palette, style, per-section cues
- **Music direction** — primary mood, genre, energy, instrumentation, arc
- **Thumbnail direction** — primary concept, emotional hook, text overlay words, best candidate image
- **Title direction** — core hook phrase, primary keyword, supporting keywords, emotional target

**Weighting system:** Each direction block uses primary / supporting / avoid hierarchy. Downstream agents prioritize accordingly.

---

## Production Tracks

### Track A — Narrated Content
**Formats:** `long` / `short` / `long+short`

#### Full Pipeline (Long)

```
1. Research + Angle Gen
   - Agent searches topic before writing
   - Logs facts, stats, examples, hook material, audience language
   - Generates 2–3 angle options → user selects
   - Angle locked before any writing begins

2. Script Gen
   - Agent uses channel script-formula.md
   - Follows hook → intro → body (sections) → bonus → outro structure
   - Embeds [IMAGE CUE] markers at each section break
   - Target: 12–15 min / ~1,700–2,100 words (channel default, overridable)

3. Production Brief Gen
   - Generated in same pass as script
   - Image direction, music direction, thumbnail direction, title direction
   - Primary / supporting / avoid weighting throughout
   - All downstream agents read this file

4. Image Gen (Flux)
   - One image per script section
   - Uses image-framework.md + per-section IMAGE CUE from production brief
   - Output: ordered image set

5. VO Gen (ElevenLabs)
   - Uses channel voice ID (fixed per channel, never changes)
   - Full script narration
   - Output: VO audio file

6. Music Gen (Sonauto)
   - Fresh track generated per video (not reused)
   - Uses music-framework.md + music direction from production brief
   - Background role — sits under VO
   - Output: music audio file

7. ── TELEGRAM CHECKPOINT 1 ──
   - Agent sends asset summary + previews
   - User approves or requests regen
   - On approval: proceed to compile + thumbnail (parallel)

8a. Compile (FFmpeg)                    ← runs in parallel with 8b
    - 16:9 1080p YouTube standard
    - Images: Ken Burns motion (subtle scale/pan)
    - Transitions: crossfade between images
    - Image timing: driven by VO section breaks
    - Audio: music layer + VO layer on top

8b. Thumbnail Gen (Nano Banana 2)       ← runs in parallel with 8a
    - Dedicated generated image — not a video frame
    - Uses thumbnail-formula.md + thumbnail direction from production brief
    - NB2 prompt constructed from: subject, mood, composition, color, text overlay
    - Text overlay words pulled from finalized title
    - Requires title to be finalized before generation
    - Output: thumbnail.png at 4K resolution
    - NOTE: Title gen (step 9) must complete before 8b begins

9. Title Gen
   - @script-writer reads title-formula.md + production brief title direction
   - Generates 3–5 candidates with pattern, character count, thumbnail pairing note
   - User selects title → title locked
   - Locked title feeds: thumbnail text overlay (8b), teaser CTA (if long+short), description (10)

10. Description + Hashtags Gen
    - @script-writer reads shared description-formula.md
    - Pulls: title + keywords from production brief, section titles + word counts from script
    - Pulls: CTAs, links, fixed hashtags from channel config.json
    - Generates: above-the-fold, summary, chapter markers, CTA block, hashtags
    - Chapter timestamps derived from section word count ratios

11. ── TELEGRAM CHECKPOINT 2 ──
    - Agent sends: compiled video + thumbnail + title + description + hashtags
    - User reviews all elements
    - User approves and replies with post schedule time
    - Agent schedules post via YouTube API
```

#### Short Derivation (from Long, long+short format only)

```
1. Teaser Script Gen (Mode A)
   - @script-writer reads teaser-formula.md — Mode A
   - Inputs: script.md + production-brief.md from current session
   - Extracts: strongest tension, most surprising finding, payoff promise
   - Structure: hook → build → cliff → CTA (pointer to long video by exact title)
   - CTA written after long title is finalized
   - Target: 60–90 sec / ~120–150 words

2. VO Gen (ElevenLabs)
   - New VO recording using teaser script
   - Same channel voice ID

3. Asset Reuse
   - Images: reused from long (reframing for 9:16 TBD at test phase)
   - Music: trimmed/reused from long's generated track

4. Compile (FFmpeg)
   - 9:16 vertical format
   - Same Ken Burns + crossfade treatment
   - New VO, trimmed music

5. Thumbnail Gen (Nano Banana 2)
   - Short-specific thumbnail concept from teaser brief
   - 9:16 aspect ratio
   - Same NB2 process as long thumbnail

6. Title + Description + Hashtags Gen
   - Short-specific copy, same agent
   - Description simplified for shorts format (no chapters)

7. ── TELEGRAM CHECKPOINT 2 (bundled with long) ──
   - Both long and short reviewed in same session
   - Two separate schedule times set
   - Long posts first, short follows
```

---

### Track B — Music Only
**Format:** `music-only`

#### Full Pipeline

```
1. Session Inputs
   - User provides: image concept context
   - User provides: music concept context
   - User chooses: video length (3-8 hours)
   - System calculates: number of 30-min segments

2. Per-Segment Generation (repeated per segment)

   a. Image Gen (Flux)
      - One image per segment
      - Uses image-framework.md + session image concept
      - Output: static image

   b. Kling Animation
      - Each image passed through Kling photo-to-video
      - Subtle animation, loop-friendly, nothing action-packed
      - No Ken Burns — animation IS the motion
      - Output: short animated clip per segment

   c. Music Gen (Sonauto)
      - One ~30-minute track per segment
      - Uses music-framework.md + session music concept
      - Output: audio file per segment

3. ── TELEGRAM CHECKPOINT 1 ──
   - Sample previews of segments sent
   - User approves or requests regen
   - On approval: proceed to compile

4. Compile (FFmpeg)
   - 16:9 1080p YouTube standard
   - Each segment: animated clip looped to match track duration
   - Transitions: crossfade between segments (audio + video)
   - Output: single stitched video (3-8 hours)

5. Thumbnail Gen (Nano Banana 2)
   - Agent selects strongest image concept from segments
   - Music-only style: visual-only, minimal or no text overlay
   - Uses thumbnail-formula.md, NB2 prompt constructed for ambient/mood aesthetic

6. Title + Description + Hashtags Gen
   - Music-focused copy
   - Chapter markers per segment in description

7. ── TELEGRAM CHECKPOINT 2 ──
   - Final video review
   - Approve title, description, hashtags
   - Set schedule time
   - Agent schedules post
```

---

## Agent Team (Shared Across All Channels)

Five agents, defaulted for every video project. No on-the-fly creation, no user selection.

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| `@content-strategist` | strategist | Reads channel config, plans content, extracts image cues from production brief, drives session |
| `@script-writer` | content | Research, script gen, production brief gen, teaser script, title, description, hashtags |
| `@asset-producer` | producer | Calls Flux (body images), ElevenLabs (VO), Sonauto (music), Kling (animation) |
| `@video-compiler` | engineer | FFmpeg compilation for all formats, thumbnail gen via NB2 (`nanobana.ts`) |
| `@channel-manager` | ops | YouTube scheduling/posting, Telegram approval bot, channel config management |

---

## Image Generation Routing

Two image generation tools with distinct responsibilities:

| Tool | File | Purpose | When |
|------|------|---------|------|
| Flux | `shared/flux.ts` | Body images — one per script section | During asset production, after script complete |
| Nano Banana 2 | `shared/nanobana.ts` | Thumbnails only — dedicated generated image | After title locked, runs parallel with FFmpeg compile |

**NB2 advantages for thumbnails:** Google Search grounding for accurate subject rendering, native precision text rendering, 4K output at Flash speed.

**`nanobana.ts` responsibilities:**
- Accepts thumbnail direction block from production brief
- Accepts finalized text overlay words from locked title
- Constructs thumbnail-optimized prompt per `thumbnail-formula.md`
- Calls `gemini-3.1-flash-image-preview` via Gemini SDK
- Aspect ratio: 16:9 for long, 9:16 for shorts
- Output: `thumbnail.png` saved to session directory

---

## API Stack

| Service | Purpose | Cost Profile |
|---------|---------|-------------|
| ElevenLabs | Voice over generation | Per character, varies by plan |
| Sonauto | Music generation | TBD — per generation |
| Flux | Body image generation | Per image, pay-as-you-go |
| Nano Banana 2 (Gemini) | Thumbnail generation | Per image via Gemini API — pay-as-you-go |
| Kling | Photo-to-video animation | Per second of output |
| YouTube Data API | Upload + scheduling | Free |
| Telegram Bot API | Human approval flow | Free |
| FFmpeg | Video compilation | Free, self-hosted |

**Environment variables required:**
- `ELEVENLABS_API_KEY`
- `FLUX_API_KEY`
- `GEMINI_API_KEY` ← for Nano Banana 2
- `SONAUTO_API_KEY`
- `KLING_API_KEY`
- `TELEGRAM_BOT_TOKEN`

All shared keys in `.env` at project root. YouTube OAuth per channel in `projects/ch-[name]/config.json`.

---

## Telegram Approval Flow

**Two checkpoints per video production run.**

### Checkpoint 1 — Asset Review (pre-compile)
- Triggered after: all assets generated (images, VO, music)
- Bot sends: asset summary, sample previews
- User responds: `approve` / `regen` / `regen [notes]`
- On approve: compilation + thumbnail generation begin (parallel)

### Checkpoint 2 — Final Review (pre-post)
- Triggered after: compilation complete + thumbnail complete
- Bot sends: final video + thumbnail + title + description + hashtags
- User responds: `approve` then replies with schedule time
- On approve + time: YouTube scheduled post is set

**For long+short:** Both videos reviewed in Checkpoint 2 together. User sets two separate times.

---

## Code Standards

Mirrors frequency-soundscape conventions:
- TypeScript strict mode — no `any`, explicit return types
- Naming: kebab-case files, PascalCase classes/types, camelCase functions, UPPER_SNAKE_CASE constants
- Formatting: Prettier, single quotes, semicolons, 2-space indent, 100 char line width
- Imports: external libs → internal utils → services → types
- Async: always async/await, never callbacks
- Errors: custom error classes per domain

---

## Agent Factory Integration

CLAUDE.md at project root fires the session-start hook:
```
bash ~/.claude/hooks/session-start.sh "youtube-automation" "$(pwd)"
```

Agents are pre-defined in `.claude/agents/`. The factory hook shows existing agents at session start. No new agents created on the fly — the five core agents are permanent for this project type. If new agent types are added in future they are added to the skills fork, not created interactively.

---

## What Is Still TBD

- [ ] Image reframing strategy for 9:16 shorts (test at implementation phase)
- [ ] Sonauto pricing/limits at scale
- [ ] Kling API availability and loop output specs
- [ ] Skills required per agent (to be mapped when we reach agent file creation)
- [ ] `image-framework.md` template (next session)
- [ ] `music-framework.md` template (next session)
- [ ] `youtube-niche-researcher` — covered in separate document (not started)

---

*Last updated: session 2 — framework files complete, NB2 added for thumbnails, production brief system defined, image routing established, description formula finalized.*
