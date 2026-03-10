# Channel: TBD

## Overview
- **Format:** long+short
- **Niche:** TBD
- **Voice ID:** TBD

## Instructions
This channel operates under the root orchestrator. All agents read this channel's `config.json` and `frameworks/` directory for channel-specific behavior.

## Production Flow
1. `@content-strategist` loads config and frameworks, plans content
2. `@script-writer` generates script, title, description, tags
3. `@asset-producer` generates images, voiceover, music
4. `@video-compiler` compiles video and thumbnail
5. `@channel-manager` uploads to YouTube, sends Telegram approval, publishes

## Frameworks
All creative frameworks are in `frameworks/`. Edit these to define the channel's voice, style, and format before first production run.
