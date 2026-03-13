# Runway Animation Producer — Skill File
# Location: .claude/skills/runway-animation-producer.md
# Read before every Runway Gen-4 call.

---

## Role

You are the Runway animation prompt specialist. Your job is simple:

1. Read the channel's `animation-framework.md`
2. Select the appropriate confirmed prompt for the scene type
3. Pass it with correct parameters to `runway.ts`

Do not write custom prompts from scratch. Do not layer motion types. Do not describe the scene. Select from the confirmed prompt library in the channel framework and trust the model.

---

## Track Routing

**Track B (music-only) → Use Runway.** This skill applies.

**Track A (narrated) → Do not use Runway.** Ken Burns via FFmpeg only. Stop here.

Check `config.json` format field if unsure.

---

## The Only Rule That Matters

**One motion concept. One direction word. `loopable` as the closer.**

The model reads the image and self-populates detail. It detects subject presence, neon elements, atmospheric conditions, and surface types automatically. Your prompt gives it a direction — the model does the rest.

```
[Single motion concept with direction word], loopable
```

Maximum 12 words. If you are writing more than 12 words, stop and simplify.

---

## Prompt Selection Workflow

```
1. Identify scene type from the Flux image — rooftop / street / tunnel / bridge / facade
2. Check channel animation-framework.md prompt selection table
3. Select the matching confirmed prompt
4. Set parameters per the table below
5. Pass to runway.ts
6. Generate minimum 3 clips per image
7. Select strongest loop
8. Log output
```

That is the entire workflow. No vision analysis step. No layering decisions. No intensity calibration.

---

## Parameters

| Parameter | Value |
|-----------|-------|
| `model` | `gen4_turbo` |
| `duration` | `10` |
| `ratio` | `1280:720` (16:9) or `720:1280` (9:16) |
| `seed` | Match Flux session seed |
| `promptImage` | Source Flux image path |
| `promptText` | Confirmed prompt from framework (max 12 words) |

---

## Output Selection Criteria

Generate 3 clips minimum per image. Select the clip where:

- Loop cut is cleanest
- Camera drift (if present) is slow and reads as intentional cinematic push
- Model-populated detail is present but not distracting
- No artifacting on fine linework or repeated surface textures

---

## Hard Rules

- Never describe the scene in the prompt
- Never exceed 12 words
- Never layer multiple motion types
- Never use negative instructions — no "no camera movement," no "static frame"
- Never use long loop anchor phrases — `loopable` only
- Never specify intensity — the model reads the image and calibrates itself
- Never call Runway for Track A productions

---

## Quality Checklist

- [ ] Track B confirmed — not a narrated channel
- [ ] Scene type identified
- [ ] Prompt selected from channel framework confirmed list
- [ ] Prompt is 12 words or fewer
- [ ] Prompt ends with `loopable`
- [ ] Seed matches Flux session seed
- [ ] Duration set to 10 seconds
- [ ] 3 clips generated for selection

---

## Output Logging

After each session, log:

```markdown
## Animation Log
| Segment | Image | Prompt | Seed | Duration | Selected |
|---------|-------|--------|------|----------|---------|
| Seg 1 | rooftop-01.png | Atmospheric haze drifting across the city, loopable | 847392 | 10s | clip-2 |
```
