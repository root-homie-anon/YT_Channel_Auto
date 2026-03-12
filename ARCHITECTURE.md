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

## Project Structure (Current)

```
YT_Channel_Auto/
├── CLAUDE.md                          ← master orchestrator + autonomy rules
├── ARCHITECTURE.md                    ← this file
├── ROADMAP.md                         ← progress tracker
├── package.json                       ← ESM, TypeScript, googleapis
├── tsconfig.json                      ← strict, Node16 module
├── .env.example                       ← all required API keys
├── .prettierrc                        ← single quotes, semi, 100 width
├── .gitignore
├── src/
│   ├── index.ts                       ← barrel exports
│   ├── types/index.ts                 ← all type definitions
│   ├── errors/index.ts                ← custom error classes
│   ├── services/
│   │   ├── index.ts                   ← service barrel exports
│   │   ├── pipeline.ts                ← full pipeline orchestrator
│   │   ├── flux-service.ts            ← image generation
│   │   ├── elevenlabs-service.ts      ← VO generation
│   │   ├── sonauto-service.ts         ← music generation
│   │   ├── runway-service.ts          ← photo-to-video animation
│   │   ├── nanobana-service.ts        ← Gemini NB2 thumbnail generation
│   │   ├── ffmpeg-service.ts          ← video compilation + thumbnails
│   │   ├── youtube-service.ts         ← upload + scheduling
│   │   └── telegram-service.ts        ← approval bot
│   └── utils/
│       ├── config-loader.ts           ← channel config + framework loader
│       ├── env.ts                     ← .env loader + requireEnv()
│       ├── logger.ts                  ← structured logger
│       └── file-helpers.ts            ← fs utilities
├── shared/
│   ├── description-formula.md         ← shared across all channels
│   ├── config.ts                      ← global API key loader
│   ├── init-channel.ts                ← interactive channel setup CLI
│   ├── nb2-setup.md                   ← Nano Banana 2 integration guide
│   ├── channel-templates/             ← CLAUDE.md templates per format
│   │   ├── template-long.md
│   │   ├── template-short.md
│   │   ├── template-long-short.md
│   │   └── template-music-only.md
│   └── (legacy .ts stubs — superseded by src/services/)
├── .claude/
│   └── agents/
│       ├── content-strategist.md
│       ├── script-writer.md
│       ├── asset-producer.md
│       ├── video-compiler.md
│       └── channel-manager.md
└── projects/
    └── ch-tbd/
        ├── CLAUDE.md
        ├── config.json
        └── frameworks/
            ├── script-formula.md
            ├── image-framework.md
            ├── music-framework.md
            ├── thumbnail-formula.md
            ├── title-formula.md
            └── teaser-formula.md
```

> **Note:** Legacy `.ts` files in `shared/` (elevenlabs.ts, flux.ts, etc.) predate the `src/` rewrite and are superseded. The canonical service code is in `src/services/`.

**Key principle:** Agents are defined once at the root level and shared across all channel projects. Channel config drives agent behavior — agents read `config.json` from the active channel directory at runtime.

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
   - Script structure formula (provided by user, stored in config)
   - Image generation prompt framework (provided by user, stored in config)
   - Music style framework (provided by user, stored in config)
   - Thumbnail formula (stored in config)
   - Title/description/tags formula (stored in config)

The system generates the channel folder, `CLAUDE.md`, and `config.json` automatically from these inputs. No manual file creation required.

---

## Production Tracks

### Track A — Narrated Content
**Formats:** `long` / `short` / `long+short`

#### Full Pipeline (Long)

```
1. Script Gen
   - Agent uses channel script formula from config
   - Topic provided by user at session start
   - Output: structured script with sections

2. Image Cue Extraction
   - Agent reads script sequentially
   - Extracts visual context clues per section
   - Maps image prompts to script timeline
   - Minimal user input required

3. Image Gen (Flux)
   - One image per script section
   - Uses channel image prompt framework + extracted cues
   - Output: ordered image set

4. VO Gen (ElevenLabs)
   - Uses channel voice ID (fixed per channel, never changes)
   - Full script narration
   - Output: VO audio file

5. Music Gen (Sonauto)
   - Fresh track generated per video (not reused)
   - Uses channel music style framework
   - Background role — sits under VO
   - Output: music audio file

6. ── TELEGRAM CHECKPOINT 1 ──
   - Agent sends asset summary + previews
   - User approves or requests regen
   - On approval: proceed to compile

7. Compile (Remotion)
   - 16:9 1080p YouTube standard
   - Images: Ken Burns motion (subtle scale/pan)
   - Transitions: crossfade between images
   - Image timing: driven by VO section breaks
   - Audio: music layer + VO layer on top

8. Thumbnail Gen
   - Agent selects most visually striking script image
   - Generates thumbnail-optimized version
   - Formula: bold 3-5 word text, high contrast,
     single focal point, curiosity gap
   - Uses channel thumbnail formula from config

9. Title / Description / Tags Gen
   - Same agent handles all three (copy agent)
   - Title formula: keyword front-loaded, curiosity gap,
     optimal length — formula stored in channel config
   - Description: YouTube best practices template
     from channel config, includes CTAs, chapter markers
   - Tags/hashtags: YouTube algorithm-aligned,
     trends-informed — framework in channel config

10. ── TELEGRAM CHECKPOINT 2 ──
    - Agent sends final compiled video
    - User reviews video, title, description, tags
    - User approves and replies with post schedule time
    - Agent schedules post via YouTube API
```

#### Short Derivation (from Long, long+short format only)

```
1. Teaser Script Gen
   - Agent takes long script as input
   - Uses teaser formula from channel config
   - Goal: hook + build intrigue + drive viewers to full video
   - NOT a summary — a setup that leaves them wanting more

2. VO Gen (ElevenLabs)
   - New VO recording using teaser script
   - Same channel voice ID

3. Asset Reuse
   - Images: reused from long (reframing for 9:16 TBD at test phase)
   - Music: trimmed/reused from long's generated track

4. Compile (Remotion)
   - 9:16 vertical format
   - Same Ken Burns + crossfade treatment
   - New VO, trimmed music

5. Thumbnail Gen
   - Same process as long, optimized for short format

6. Title / Description / Tags Gen
   - Short-specific copy, same agent

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
      - Uses channel image framework + session image concept
      - Output: static image

   b. Runway ML Animation
      - Each image passed through Runway ML Gen-4 Turbo photo-to-video
      - Subtle animation, loop-friendly, nothing action-packed
      - No Ken Burns — animation IS the motion
      - Output: short animated clip per segment

   c. Music Gen (Sonauto)
      - One ~30-minute track per segment
      - Uses channel music framework + session music concept
      - Output: audio file per segment

3. ── TELEGRAM CHECKPOINT 1 ──
   - Sample previews of segments sent
   - User approves or requests regen
   - On approval: proceed to compile

4. Compile (Remotion)
   - 16:9 1080p YouTube standard
   - Each segment: animated clip looped to match track duration
   - Transitions: crossfade between segments (audio + video)
   - Output: single stitched video (3-8 hours)

5. Thumbnail Gen
   - Agent selects strongest image from segments
   - Music-only style: visual-only, no text overlay typically
   - Uses channel thumbnail formula

6. Title / Description / Tags Gen
   - Music-focused copy formula
   - Chapter markers per segment in description

7. ── TELEGRAM CHECKPOINT 2 ──
   - Final video review
   - Approve title, description, tags
   - Set schedule time
   - Agent schedules post
```

---

## Agent Team (Shared Across All Channels)

Five agents, defaulted for every video project. No on-the-fly creation, no user selection.

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| `@content-strategist` | strategist | Reads channel config, plans content, extracts image cues from script, drives session |
| `@script-writer` | content | Script gen (long), teaser script gen (short), title/description/tags/hashtags |
| `@asset-producer` | producer | Calls Flux (images), ElevenLabs (VO), Sonauto (music), Runway ML (animation) |
| `@video-compiler` | engineer | Remotion compilation for all formats, thumbnail gen |
| `@channel-manager` | ops | YouTube scheduling/posting, Telegram approval bot, channel config management |

---

## API Stack

| Service | Purpose | Cost Profile |
|---------|---------|-------------|
| ElevenLabs | Voice over generation | Per character, varies by plan |
| Sonauto | Music generation | TBD — per generation |
| Flux | Image generation | Per image, pay-as-you-go |
| Runway ML | Photo-to-video animation (Gen-4 Turbo) | $0.05/sec of output, pay-as-you-go |
| YouTube Data API | Upload + scheduling | Free |
| Telegram Bot API | Human approval flow | Free |
| Remotion | Video compilation (React-based, programmatic) | Free — individual/teams up to 3 |

All API keys stored in `.env` at project root. YouTube OAuth credentials stored per channel in `projects/ch-[name]/config.json`. Most keys are shared across channels except YouTube OAuth (one per channel account).

---

## Telegram Approval Flow

**Two checkpoints per video production run.**

### Checkpoint 1 — Asset Review (pre-compile)
- Triggered after: all assets generated (images, VO, music)
- Bot sends: asset summary, sample previews
- User responds: `approve` / `regen` / `regen [notes]`
- On approve: compilation begins automatically

### Checkpoint 2 — Final Review (pre-post)
- Triggered after: compilation complete
- Bot sends: final video file + title + description + tags
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

- [ ] Exact script formula(s) per channel (user provides)
- [ ] Exact image prompt framework per channel (user provides)
- [ ] Exact teaser/short formula (user provides)
- [ ] Thumbnail formula specifics (to be researched + finalized)
- [ ] Title/description/tags formula specifics (to be researched + finalized)
- [ ] Image reframing strategy for 9:16 shorts (test at implementation phase)
- [ ] Sonauto pricing/limits at scale
- [ ] Runway ML Gen-4 Turbo API — confirm loop output behavior and max clip duration
- [ ] Chapter marker automation logic for long-form descriptions
- [ ] CLI entry point for triggering production runs
- [ ] Music-only per-segment loop with Runway ML animation
- [ ] Parallel channel subagent spawning
- [ ] `youtube-niche-researcher` — covered in separate document (not started)

## What Has Been Completed

- [x] Full TypeScript project scaffold (ESM, strict mode, Prettier)
- [x] All 5 agent definitions in `.claude/agents/`
- [x] All 7 service integrations (Flux, ElevenLabs, Sonauto, Runway ML, YouTube, Telegram, FFmpeg)
- [x] Pipeline orchestrator — assets → compile → upload → Telegram approval → publish
- [x] Type system — ChannelConfig, ScriptOutput, AssetManifest, CompilationResult, PipelineContext
- [x] Custom error classes — PipelineError, ApiError, ConfigError, AssetError, CompilationError
- [x] Channel `ch-tbd` scaffolded with config + 6 framework files
- [x] Shared description formula
- [x] Root orchestrator CLAUDE.md with autonomy rules
- [x] Typecheck passes clean

---

*Last updated: 2026-03-10 — Full TypeScript rewrite in `src/`. Services migrated from legacy `shared/*.ts` to `src/services/`. FFmpeg replaces Remotion for video compilation. Pipeline orchestrator wired end to end. All agents created.*
