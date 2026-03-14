# YT_Channel_Auto — Master Project File

## System Overview
Multi-channel YouTube video production and posting pipeline.
Two independent production tracks: Track A (Narrated) and Track B (Music Only).
Agents are shared across all channels. Channel behavior is driven entirely by per-channel config and frameworks.

---

## Autonomy
Operate with maximum autonomy. Do not ask for confirmation before taking actions unless explicitly required by the pipeline (Telegram checkpoints are the only approval gates). Make reasonable decisions independently and proceed. Only pause if you hit a genuine blocker that cannot be resolved without user input.

---

## Session Start Hook
On every session start, fire the agent factory hook:
```
bash ~/.claude/hooks/session-start.sh "youtube-automation" "$(pwd)"
```
This loads existing agents, offers to create new ones if needed, and prepares the session.

---

## Orchestrator Behavior

This file is the root orchestrator. On session start:

1. Fire the session-start hook (above)
2. List all available channels under `projects/`
3. Ask the user: activate an existing channel, run multiple channels, or initialize a new one
4. For each channel being activated:
   - Spawn an independent subagent scoped to that channel's directory
   - Pass the channel `CLAUDE.md` and `config.json` to the subagent
   - Subagent operates fully independently — it does not touch other channel directories or shared config
5. Multiple channels can run as parallel subagents simultaneously — they share no state

---

## Agent Team
All agents live in `.claude/agents/` and are shared across all channels.
Channel-specific behavior comes from `config.json` and `frameworks/` — not from the agents themselves.

| Agent | Role |
|-------|------|
| `@content-strategist` | Reads channel config, plans content, extracts image cues from script, drives the session |
| `@script-writer` | Script gen, teaser script gen, title, description, tags, hashtags |
| `@asset-producer` | Calls Flux (images), ElevenLabs (VO), Stable Audio (music), Runway ML (animation) |
| `@video-compiler` | FFmpeg compilation for all formats, thumbnail generation |
| `@channel-manager` | YouTube scheduling/posting, Telegram approval bot, channel config management |
| `@niche-researcher` | One-time agent: researches successful channels in the niche, populates all framework files with data-driven creative direction |

---

## Channel Initialization Flow

When the user selects "initialize a new channel", run this flow interactively:

### Step 1 — Collect Inputs
Prompt the user for:
- **Channel name** — used as folder name: `projects/ch-[channel-name]/`
- **Format** — one of: `long` / `short` / `long+short` / `music-only`
- **YouTube OAuth credentials** — stored per channel in `config.json`
- **ElevenLabs voice ID** — fixed per channel, never changes
- **Creative frameworks** — scaffolded from templates, then automatically populated by `@niche-researcher`

### Step 2 — Generate Channel Structure
Create the following automatically:

```
projects/ch-[channel-name]/
├── CLAUDE.md              ← generated from channel template
├── config.json            ← generated from inputs
└── frameworks/
    ├── script-formula.md        ← scaffolded from template
    ├── image-framework.md       ← scaffolded from template
    ├── music-framework.md       ← scaffolded from template
    ├── thumbnail-formula.md     ← scaffolded from template
    ├── title-formula.md         ← scaffolded from template
    └── teaser-formula.md        ← only if format includes shorts
```

### Step 3 — Niche Research & Framework Population
After scaffolding, spawn `@niche-researcher` with the channel's niche and format.
The agent researches successful channels in the niche, then populates all framework files with:
- Niche-specific creative direction (tone, style, audience, pacing)
- Data-driven defaults based on what works in the space
- Concrete examples drawn from top-performing channels
- All bracketed placeholders replaced with real values

This is a one-time operation. After population, frameworks can be manually edited.

### Step 4 — config.json Schema
Generate `config.json` from collected inputs:

```json
{
  "channel": {
    "name": "",
    "slug": "",
    "format": "",
    "niche": ""
  },
  "credentials": {
    "youtubeOAuthPath": "projects/ch-[name]/.youtube-oauth.json",
    "elevenLabsVoiceId": ""
  },
  "frameworks": {
    "script": "frameworks/script-formula.md",
    "image": "frameworks/image-framework.md",
    "music": "frameworks/music-framework.md",
    "thumbnail": "frameworks/thumbnail-formula.md",
    "title": "frameworks/title-formula.md",
    "teaser": "frameworks/teaser-formula.md"
  }
}
```

`teaser` framework path only included if format includes shorts. Duration and segment count for music-only channels are set at production time, not during channel init.

---

## Shared Resources

### API Keys
All shared keys live in `.env` at project root. See `.env.example` for required variables.
Never commit `.env`. YouTube OAuth credentials are per-channel and stored in each channel's directory.

### Shared Description & Hashtags Formula
The only formula shared across all channels lives at:
```
shared/description-formula.md
```
All channels use this for description and hashtag generation. Channel-specific title, script, image, music, and thumbnail formulas live in the channel's own `frameworks/` folder.

---

## Code Standards
- TypeScript strict mode — no `any`, explicit return types
- Naming: kebab-case files, PascalCase classes/types, camelCase functions, UPPER_SNAKE_CASE constants
- Formatting: Prettier, single quotes, semicolons, 2-space indent, 100 char line width
- Imports: external libs → internal utils → services → types
- Async: always async/await, never callbacks
- Errors: custom error classes per domain
