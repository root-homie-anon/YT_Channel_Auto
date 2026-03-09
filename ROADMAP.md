# YT_Channel_Auto — Project Roadmap

---

## Priority 1 — Project Scaffold & Infrastructure

Get the repo structure in place and all external services connected before any pipeline work begins.

- Initialize repo with full folder structure per architecture doc
- Set up `.env` with all shared API keys (ElevenLabs, Flux, Sonauto, Runway ML)
- Build `config.ts` — env loader and validator
- Write channel initialization flow — prompts user, generates channel folder, `config.json`, `CLAUDE.md`, and `frameworks/` scaffold
- Confirm YouTube OAuth flow works per channel
- Confirm Telegram bot is live and receiving messages
- Stub all five agent files in `.claude/agents/`

---

## Priority 2 — Shared API Integrations

Build and test each service integration independently before wiring into pipelines.

- `elevenlabs.ts` — VO generation, accepts script + voice ID, returns audio file
- `flux.ts` — image generation, accepts prompt, returns image file
- `sonauto.ts` — music generation, accepts style prompt + duration, returns audio file
- `runway.ts` — photo-to-video animation via Runway ML Gen-4 Turbo, accepts image, returns animated clip
- `youtube.ts` — upload + scheduled post via YouTube Data API
- `telegram.ts` — send message/file, receive and parse user replies
- `remotion.ts` — video compilation via Remotion (React-based), handles 16:9 and 9:16, Ken Burns, crossfade, audio layering

---

## Priority 3 — Track A Pipeline (Narrated — Long Format)

Wire the full long-form narrated pipeline end to end.

- `@content-strategist` — reads channel config, extracts image cues from script, maps to timeline
- `@script-writer` — generates long script using script-formula.md
- `@asset-producer` — calls Flux, ElevenLabs, Sonauto in sequence
- Telegram Checkpoint 1 — asset preview, approve/regen flow
- `@video-compiler` — Remotion compile, Ken Burns + crossfade, 16:9 1080p
- `@video-compiler` — thumbnail generation
- `@script-writer` — title, description, tags generation
- Telegram Checkpoint 2 — final review, schedule time input
- `@channel-manager` — YouTube scheduled post

---

## Priority 4 — Track A Pipeline (Short Derivation)

Extend narrated pipeline to support short format from long content.

- `@script-writer` — teaser script from long script using teaser-formula.md
- `@asset-producer` — new VO for teaser, reuse/trim music from long
- `@video-compiler` — 9:16 compile, image reframing strategy
- Thumbnail + copy generation for short
- Bundle with long in Telegram Checkpoint 2 — two schedule times

---

## Priority 5 — Track B Pipeline (Music Only)

Build the music-only production track independently.

- Session input flow — image concept, music concept, video length, segment count
- Per-segment loop — Flux image → Runway ML animation → Sonauto music track
- Telegram Checkpoint 1 — segment sample previews
- FFmpeg compile — loop animated clips to match track duration, crossfade between segments
- Thumbnail + copy generation (music-only formulas)
- Telegram Checkpoint 2 — final review + schedule

---

## Priority 6 — Orchestrator & Parallel Channel Support

Enable multiple channels to run simultaneously from a single root orchestrator.

- Root `CLAUDE.md` session-start hook and orchestrator logic
- Subagent spawning per channel — scoped to channel directory
- Parallel session management — channels run independently without state bleed
- Channel selection and session kick-off flow

---

## Priority 7 — Control Center Dashboard

Lightweight web dashboard on the VM for monitoring and managing all channels.

- Node/Express server setup on VM
- Channel status board — idle / pipeline step / waiting for approval / scheduled / posted
- Run history per channel
- Kick off next video flow per channel
- Live pipeline progress updates (current step)
- Basic auth to protect the dashboard

---

## Priority 8 — Hardening & Scale

Polish, error handling, and production readiness.

- Error handling and retry logic per API integration
- Cost tracking per video and per channel
- Agent behavior testing across channel configs
- Multi-channel parallel stress test
- Documentation — setup guide, channel init guide, agent reference

---

*Future: Connect to YT_Channel_Stats for automated topic discovery and trend-based video triggering.*
