# Music Framework — Strange Universe

> This file defines how `@asset-producer` generates background music for Strange Universe videos.
> Music is generated via Sonauto (`shared/sonauto.ts`).
> Track A only — this is a narrated channel, not a music-only channel.
> One fresh background track per video, sits under VO at low volume.

---

## Channel Music Identity

**Genre:** Dark cinematic ambient with subtle electronic undertones — think the score to a high-end investigation documentary, not a sci-fi movie soundtrack
**Mood range:** Investigative tension / unease / quiet awe / revelation weight / reflective uncertainty
**Energy ceiling:** Low to medium — the music must never compete with the narration. It is atmosphere, not performance.
**Signature sound:** Deep, slow-evolving textures that create a sense of something vast and hidden just beyond perception. The music should feel like the sonic equivalent of looking at a dark sky and knowing something is watching back.

---

## Standing Defaults (Track A — Background Under VO)

**Default Energy:** Low — present but unobtrusive, like a room tone with intention
**Default BPM:** 55–75 BPM, or no discernible tempo for pure ambient passages
**Default Instrumentation:**
- Deep sub-bass synth drones (foundation layer — felt more than heard)
- Slow-evolving synthesizer pads with cold, dark texture
- Sparse piano — single notes with heavy reverb, placed infrequently for emotional punctuation
- Distant metallic resonance or processed industrial textures (suggests military/institutional environment)
- Subtle string sustains (cello or low viola) for sections requiring emotional weight
- Occasional processed radio static or signal interference texture (very subtle, very infrequent — suggests intercepted communication)

**Mood Range:** Investigative tension as default, shifting toward quiet awe for evidence revelation sections, pulling into reflective stillness for outro
**Structure:** Evolving ambient with very slow textural changes. No melodic hook that demands attention. No rhythm section. Pure atmospheric support. The music should be noticeable when it stops, not when it plays.

**Avoid:**
- Lyrics of any kind
- Recognizable melody that pulls focus from narration
- Horror movie stingers, jump-scare hits, or sudden dynamic spikes
- Cheesy sci-fi sound effects (theremin, cartoon "alien" sounds)
- Upbeat or triumphant tones — even revelations should feel weighty, not celebratory
- Heavy percussion or any driving beat
- Bright, warm, or comforting tones — the music should never feel safe
- Generic "mystery" music that sounds like a true crime podcast

---

## Sonauto Prompt Construction (Track A)

```
[GENRE + STYLE]: Dark cinematic ambient with electronic undertones, investigation documentary score
[MOOD]: [Primary mood from production brief] — [supporting mood if applicable]
[ENERGY]: Low — ambient background layer, never competing with spoken narration
[INSTRUMENTATION]: Deep sub-bass synth drones, slow-evolving cold synth pads, sparse reverb-heavy piano, distant metallic textures, subtle low string sustains. No percussion. No melody.
[TEMPO]: Slow and deliberate — 55–75 BPM or no discernible tempo
[DYNAMICS]: Minimal dynamic variation — no sudden drops or surges that would compete with VO. Subtle swells only at major section transitions.
[STRUCTURE]: No lyrics. No prominent melodic hook. Continuous evolving atmospheric texture. Background presence only — the music should feel like the environment, not the foreground.
[DURATION]: [Target duration in minutes — match to estimated video length, typically 15–22 minutes]
[ARC]: [From production brief — typically: "opens with sparse tension, builds subtly through the investigation, swells gently at key revelations, pulls back to reflective stillness for outro"]
[AVOID]: Lyrics, melody, percussion, horror stingers, sci-fi cliches, bright tones, warmth, anything that sounds like a video game or movie trailer
```

---

## Music Arc by Script Section

The music should subtly shift across the video's structure:

| Script Section | Music Direction |
|----------------|-----------------|
| HOOK | Sparse — a single drone or pad. Let the words carry the tension. |
| INTRO | Slightly fuller — add a second texture layer. Establish the investigative mood. |
| BODY (early sections) | Steady low-level tension. Cold, institutional. The sound of digging through files. |
| RE-HOOK moments | Subtle swell — the briefest dynamic lift to mirror the narrative escalation. |
| BODY (key revelation) | Quiet awe — strings or piano enter briefly. The most emotionally present the music gets. |
| BONUS | Return to tension — something new and unsettling has been introduced. |
| OUTRO | Reflective stillness — the music thins to almost nothing. A single sustained tone. Space for the viewer to think. |

---

## Production Brief Integration

The `music direction` block in the production brief contains per-video overrides:

```
PRIMARY MOOD: [single primary emotional target]
SUPPORTING MOOD: [secondary emotional layer — optional]
AVOID MOOD: [moods that would conflict with the video]
ENERGY LEVEL: [ambient / low / gentle — never above gentle for this channel]
GENRE NOTES: [any video-specific genre shift within the channel framework]
ARC: [how the music should evolve over the video]
```

Agent reads this block, merges with channel framework defaults above, and constructs the Sonauto prompt. Production brief direction always operates within the boundaries set by this framework — it cannot override the fundamental tone (e.g., it cannot request upbeat music).

**Conflict rule:** If production brief requests energy above "gentle," agent uses "gentle" and notes the conflict in the session log.

---

## Short Format Music (Teaser)

The short uses the long video's generated music track — trimmed, not regenerated.

Trimming logic:
- Agent identifies the most emotionally engaging 60–90 seconds from the full track
- Prefers the opening section (already tuned as the hook atmosphere)
- Fades in from 0 if not already faded — no abrupt start
- Fades out with a 3-second fade at the end
- No re-generation — reuse only
