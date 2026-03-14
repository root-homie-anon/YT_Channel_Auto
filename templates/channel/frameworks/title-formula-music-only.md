# Title Formula — {{CHANNEL_NAME}}

---

## Channel Title Identity

**Title style:** {{TITLE_STYLE — e.g. "Evocative and atmospheric", "Direct and genre-forward", "Abstract and minimal"}}
**Tone:** {{TITLE_TONE — e.g. "Cinematic and poetic", "Warm and inviting", "Cold and industrial"}}
**Avoid:** Genre labels as the lead word, duration in title, all-caps, exclamation marks, emojis, generic mood words like "relaxing" or "chill"
**Character target:** 30–50 characters
**Hard cap:** 60 characters

---

## Title Patterns

The pipeline selects from these patterns using keywords extracted from the image and music prompts.

| Pattern | Structure | Example |
|---------|-----------|---------|
| Place Name | [Invented Location] | {{EXAMPLE_1}} |
| State + Location | [Mood] [Environment] | {{EXAMPLE_2}} |
| The + Abstract | The [Abstract Noun] | {{EXAMPLE_3}} |
| Compound Concept | [Noun] + [Noun] | {{EXAMPLE_4}} |
| Action Fragment | [Verb-ing] [Preposition] [Place] | {{EXAMPLE_5}} |
| Single Word | [Evocative Word] | {{EXAMPLE_6}} |
| Colon Split | [Place/Concept]: [Qualifier] | {{EXAMPLE_7}} |

---

## Keyword Pools

Titles are built by combining words from these pools. Populate with words that match the channel's visual and sonic identity.

### Environment Words
{{ENVIRONMENT_WORDS — 20 words that describe the visual world of this channel}}

### Atmosphere Words
{{ATMOSPHERE_WORDS — 15 words that describe states/moods/movements fitting this channel}}

### Abstract Nouns
{{ABSTRACT_NOUNS — 20 abstract nouns that capture the channel's feeling}}

### Color/Light Words
{{COLOR_LIGHT_WORDS — 10 words related to the channel's visual palette}}

---

## Scene Name Pool

For multi-segment videos, each segment gets a scene name for chapter markers. Populate with 20-25 evocative names that fit the channel's aesthetic:

{{SCENE_NAMES — comma-separated list of 20-25 scene names}}

---

## Construction Rules

- Never start with a genre name
- Never include duration
- Never include "mix", "compilation", "playlist", "session"
- Prefer 2–4 word titles
- One title per production — no candidate voting
- Title should feel like it could be an album track name

---

## What This Formula Does NOT Do

- No thumbnail pairing — music-only channels have no thumbnails
- No production brief integration — titles derive from prompt keywords
- No candidate voting — pipeline selects algorithmically
