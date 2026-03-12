# YT_Channel_Auto — Project Roadmap

> Last updated: 2026-03-11

---

## Priority 1 — Project Scaffold & Infrastructure ✅ COMPLETE

Get the repo structure in place and all external services connected before any pipeline work begins.

- [x] Initialize repo with full folder structure per architecture doc
- [x] Set up `.env.example` with all shared API keys (ElevenLabs, Flux, Sonauto, Runway ML)
- [x] Build `config-loader.ts` + `env.ts` — env loader and validator
- [x] Write channel initialization flow — generates channel folder, `config.json`, `CLAUDE.md`, and `frameworks/` scaffold
- [x] Confirm YouTube OAuth flow works per channel — tested and tokens saved for ch-strange-universe
- [x] Confirm Telegram bot is live and receiving messages — tested and working
- [x] Create all five agent files in `.claude/agents/`

---

## Priority 2 — Shared API Integrations ✅ COMPLETE (code written, live testing pending)

Build and test each service integration independently before wiring into pipelines.

- [x] `elevenlabs-service.ts` — VO generation, accepts script + voice ID, returns audio file (ElevenLabs v1 TTS)
- [x] `flux-service.ts` — image generation via BFL async polling, accepts prompt, returns image file
- [x] `sonauto-service.ts` — music generation via v1/generations endpoint, accepts style prompt + duration, returns audio file
- [x] `runway-service.ts` — photo-to-video animation via Runway Gen-3 Alpha, accepts image, returns animated clip
- [x] `youtube-service.ts` — upload + scheduled post via YouTube Data API
- [x] `telegram-service.ts` — send message/file, receive and parse user replies (approval polling)
- [x] `ffmpeg-service.ts` — compilation utility, handles 16:9 and 9:16, Ken Burns, crossfade, audio layering
- [x] All services implemented with correct API structures
- [ ] Live testing against real APIs — pending voice ID for ElevenLabs

---

## Priority 3 — Track A Pipeline (Narrated — Long Format) ✅ PIPELINE WIRED (untested)

Wire the full long-form narrated pipeline end to end.

- [x] `@content-strategist` — agent defined, reads channel config, extracts image cues from script
- [x] `@script-writer` — agent defined for long script using script-formula.md
- [x] `@asset-producer` — agent defined, calls Flux, ElevenLabs, Sonauto in sequence
- [x] Telegram approval — single approval gate (approve/reject via bot)
- [x] `@video-compiler` — FFmpeg compile, Ken Burns + crossfade, 16:9 1080p
- [x] `@video-compiler` — thumbnail generation via FFmpeg
- [x] `@script-writer` — title, description, tags generation (agent defined)
- [x] `@channel-manager` — YouTube upload (unlisted → Telegram approval → public)
- [x] Pipeline orchestrator (`pipeline.ts`) — wires full flow end to end
- [ ] End-to-end test with real content — **pending voice ID + frameworks**
- [ ] CLI entry point (`npm run produce -- --channel ch-tbd --topic "..."`) — **not built; dashboard serves as alternative**

---

## Priority 4 — Track A Pipeline (Short Derivation) 🔶 PARTIAL

Extend narrated pipeline to support short format from long content.

- [x] `@script-writer` — teaser script support defined in agent
- [x] `@video-compiler` — 9:16 short-form compile (`compileShortFormVideo`)
- [x] Pipeline handles `long+short` format — compiles teaser alongside long
- [ ] Image reframing strategy for 9:16 — **TBD at test phase**
- [ ] Bundle long + short in single Telegram approval — **not yet implemented**

---

## Priority 5 — Track B Pipeline (Music Only) 🔶 PARTIAL

Build the music-only production track independently.

- [x] `compileMusicOnlyVideo` in ffmpeg-service — image looped over music track
- [x] Pipeline handles `music-only` format
- [ ] Per-segment loop — Flux image → Runway ML animation → Sonauto music track — **not yet wired**
- [ ] Segment-based compilation with crossfade — **not yet implemented**
- [ ] Telegram checkpoint for segment previews — **not yet implemented**

---

## Priority 6 — Orchestrator & Parallel Channel Support 🔶 PARTIAL

Enable multiple channels to run simultaneously from a single root orchestrator.

- [x] Root `CLAUDE.md` orchestrator logic defined
- [x] Autonomy section — agents operate independently, Telegram is only gate
- [x] Channel directory structure and config isolation
- [ ] Subagent spawning per channel — **not yet implemented in code**
- [ ] Parallel session management — **not yet implemented**
- [ ] CLI channel selection flow — **not yet built**

---

## Priority 7 — Control Center Dashboard ✅ COMPLETE

Express server with REST API + SSE for monitoring and managing all channels.

- [x] Node/Express server setup — running via `npm run dashboard`
- [x] Status Board — channel status overview (idle / pipeline step / waiting / scheduled / posted)
- [x] Channel Manager — produce, queue, and history views per channel
- [x] Pipeline Monitor — live pipeline progress updates via SSE
- [x] New Channel Setup — channel initialization integrated into dashboard
- [x] OAuth flow integrated into dashboard
- [ ] Basic auth to protect the dashboard — **not yet implemented**

---

## Priority 8 — Hardening & Scale ⬜ NOT STARTED

Polish, error handling, and production readiness.

- [ ] Error handling and retry logic per API integration
- [ ] Cost tracking per video and per channel
- [ ] Agent behavior testing across channel configs
- [ ] Multi-channel parallel stress test
- [ ] Documentation — setup guide, channel init guide, agent reference

---

## Blockers

| Blocker | Status | Notes |
|---------|--------|-------|
| `.env` with real API keys | ✅ DONE | All keys set |
| YouTube OAuth per channel | ✅ DONE | Tokens saved for ch-strange-universe |
| Telegram bot | ✅ DONE | Live and tested |
| Channel config | 🔶 PARTIAL | Name/niche set for ch-strange-universe, voice ID still TBD |
| Framework files | 🔶 PARTIAL | Templates exist in `templates/channel/frameworks/`, copied to channels on init |
| CLI entry point | ⬜ NOT BUILT | Dashboard serves as alternative entry point |
| ElevenLabs voice ID | ⬜ NEEDED | Required before live API testing can proceed |

---

*Future: Connect to YT_Channel_Stats for automated topic discovery and trend-based video triggering.*
