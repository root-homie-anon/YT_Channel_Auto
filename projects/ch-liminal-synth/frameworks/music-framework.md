# Music Framework — Liminal Synth
# Location: projects/ch-liminal-synth/frameworks/music-framework.md

---

## Locked Music Prompt

This channel uses a single locked prompt for all productions. Do not modify, template, or construct from categories. Pass through unchanged.

```
electronic, Drum Machine, Bass, Lush Synthesizer Pads, Synthesizer Arp, Synth Bass, Melancholic, Vibe, Cool, Modern, Atmospheric, well-arranged composition, 115 BPM
```

This prompt is used for every segment in every production. The `musicPrompt` field in the API call is always this exact string.

---

## Generation Rules

- Model: Stable Audio 2.5 via Replicate
- Max 190 seconds per generation
- Same prompt for all segments — no variation between segments
- Do not prefix with genre name
- Do not append "no lyrics"
- Do not modify the prompt based on image concept or session inputs
- Prompt is passed through to the API unchanged

---

## What This Framework Does NOT Do

- No category defaults — the locked prompt replaces all category logic
- No template construction — no `[primary instruments], [mood], [BPM]` assembly
- No production brief integration — this is not a narrated channel
- No per-session music concept — the prompt is fixed
