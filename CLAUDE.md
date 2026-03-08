# YT_Channel_Auto — Master Project File

## System Overview
Multi-channel YouTube video production and posting pipeline.
Two production tracks: Track A (Narrated) and Track B (Music Only).

## Session Start
This file is the orchestrator entry point. On session start:
1. Show available channels under `projects/`
2. Ask user which channel to activate (or initialize a new one)
3. Spawn a subagent scoped to the selected channel directory
4. Pass the channel `CLAUDE.md` and `config.json` to the subagent
5. Multiple channels can run as independent parallel subagents

## Agent Team
All agents are defined in `.claude/agents/`. They are shared across all channels.
Channel behavior is driven by `config.json` and `frameworks/` in each channel directory.

- `@content-strategist` — session orchestration, image cue extraction
- `@script-writer` — scripts, teaser scripts, titles, descriptions, tags
- `@asset-producer` — Flux, ElevenLabs, Sonauto, Kling API calls
- `@video-compiler` — FFmpeg compilation, thumbnail generation
- `@channel-manager` — YouTube scheduling, Telegram approval bot, channel config

## Initializing a New Channel
Run the channel init flow which will prompt for:
- Channel name
- Format (long / short / long+short / music-only)
- YouTube OAuth credentials
- ElevenLabs voice ID
- Creative frameworks (script, image, music, thumbnail, title, teaser)

The system generates the channel folder, `CLAUDE.md`, `config.json`, and `frameworks/` scaffold automatically.

## Shared API Keys
All shared keys live in `.env` at project root. See `.env.example` for required vars.
