# Description Formula — [CHANNEL_NAME]

> This file defines how the agent generates the full video description and hashtags for [CHANNEL_NAME].
> It is a standalone formula — do NOT reference `shared/description-formula.md`.
> The agent reads this file after the title is locked and the script is finalized.

---

## Inputs Required Before Generation

- `[LOCKED_TITLE]` — finalized title from title-formula.md output
- `[SCRIPT_SECTIONS]` — section names and word counts from the script
- `[TOPIC_SUMMARY]` — 1-2 sentence summary of the video subject
- `[CHANNEL_CONFIG]` — from config.json: channel name, CTA lines

---

## Description Structure — Full Assembly Order

```
Block 1  — Above the Fold (2-3 lines, visible before "Show More")
Block 2  — Chapter Timestamps
⸻
Block 3  — Sources & References (optional — include when verifiable sources exist)
⸻
Block 4  — CTA Block
⸻
Block 5  — Credits
Block 6  — Copyright
```

**IMPORTANT:** Do NOT include hashtags in the description body. Hashtags are output separately in the `hashtags` array field. The pipeline appends them automatically at upload time. Including them in the description causes duplication.

---

## Block 1 — Above the Fold

**Purpose:** Highest-value real estate. First ~150 characters appear in search results and suggested feeds. SEO core — embed primary keywords naturally.
**Regenerates:** Every video. Must be unique — no boilerplate.

### Formula
```
[LINE 1]: [SUBJECT], embedding the primary keyword naturally. State the core subject as a factual claim, bold observation, or question.
[LINE 2]: What the viewer will learn or gain — frame as specific value, not vague "we explore."
[LINE 3 — optional]: A specific detail that signals depth and credibility — a name, date, reference, or provocative statement.
```

### Rules
- Lead with the specific subject, never the channel name
- Never start with "Welcome" or "In this video"
- Embed at least one primary keyword in line 1
- Tone: [CHANNEL_TONE — e.g., investigative/commanding/analytical]
- Never use ALL CAPS in the description body
- Each video's above-the-fold must be unique — no copy-paste between videos

---

## Block 2 — Chapter Timestamps

**Purpose:** Navigation + watch time boost. YouTube renders chapters in the progress bar when formatted correctly.

### Timestamp Calculation
```
Runtime per section (seconds) = (section word count / total word count) × total VO duration
Cumulative timestamp = sum of all preceding section runtimes
```

### Format
```
0:00 [Section Title]
2:34 [Section Title]
5:12 [Section Title]
```

### Rules
- First timestamp must always be `0:00` (YouTube requirement)
- Minimum 3 chapters required for YouTube to render them
- Round to nearest 5 seconds
- Section titles: short, punchy, descriptive — 2-5 words max
- Format: `M:SS` for videos under 1 hour, `H:MM:SS` for longer
- Do not use the same section names as the script — rewrite as viewer-facing chapter labels

---

## Block 3 — Sources & References

**Purpose:** Credibility signal. Include when the video references verifiable sources.
**Regenerates:** Every video. Pulled from research used during script generation.
**Optional:** If no verifiable sources exist for a topic, omit this block entirely — do not fabricate references.

### Format
```
Sources & References:
• [Source name or document title] — [brief context]
• [Source name or document title] — [brief context]
```

### Rules
- 3-6 sources per video when included
- No URLs required — just names and context (avoids link rot)
- Include specific names, titles, or institutional sources cited in the script

---

## Block 4 — CTA Block

**Static per channel. [CHANNEL_CTA_LINES]**

```
[CTA_LINE_1 — subscribe + content promise]
[CTA_LINE_2 — engagement prompt]
```

### Rules
- Exactly 2 lines, no more
- Never beg for likes — one subscribe mention is enough
- Tone matches the channel voice

---

## Block 5 — Credits

**Static — use verbatim.**

```
🎵 Music: Stable Audio 2.5
🖼️ Visuals: Flux
🎙️ Narration: ElevenLabs
```

---

## Block 6 — Copyright

**Static — never changes.**

```
© Strong Tower Media LLC – All rights reserved.
All content is original and produced by Strong Tower Media LLC using AI tools.
Unauthorized reuploads or modifications are not permitted.
```

---

## Hashtags — Separate Output Field

**IMPORTANT:** Hashtags are NOT part of the description body. Output them as a separate `hashtags` string array.
The pipeline appends them to the description and strips `#` for YouTube API tags automatically.

**Total per video: 5 hashtags. No more, no fewer.**
**The first 3 appear above the video title — make them count.**

### Structure
```json
["#[CHANNEL_TAG]", "#[NICHE_TAG]", "#[TOPIC_TAG_1]", "#[TOPIC_TAG_2]", "#[TOPIC_TAG_3]"]
```

### Fixed Tags (always first two, every video)
- `#[CHANNEL_TAG]` — channel brand
- `#[NICHE_TAG]` — primary niche anchor

### Topic Tags (3 per video, generated from script content)
Select 3 topic-specific tags using these rules:

**Selection priority:**
1. The most specific searchable term for this video's subject
2. A niche category tag
3. A supporting detail tag

**Tag rules:**
- All lowercase, no spaces
- No tag over 20 characters
- Specific beats generic
- Never duplicate the fixed tags
- Never use generic tags like `#viral`, `#trending`, `#fyp`

### Topic Tag Pool
[POPULATE_WITH_NICHE_SPECIFIC_TAGS]

---

## Shorts Description Rules

For channels with shorts (`long+short` format):
- **Above the fold:** 1-2 lines only — the single most specific, searchable claim from the short
- **No chapter markers**
- **CTA:** 1 line — pointer to full video: `Full video on the channel.`
- **Hashtags:** Same 5-tag structure
- **Total description:** Under 200 characters before hashtags

For channels without shorts (`long` format):
- This section does not apply. No shorts description rules needed.

---

## Agent Output Format

Output two separate fields:

### `description` field
The full description as a clean YouTube description — no block labels, no headers, no agent annotations, **no hashtags**. Blocks 1-6 only.

### `hashtags` field
A JSON array of exactly 5 hashtag strings, each prefixed with `#`, all lowercase.
Example: `["#channeltag", "#nichetag", "#topic1", "#topic2", "#topic3"]`

### Generation Notes (internal only, never posted)
```
--- GENERATION NOTES ---
Above-the-fold keywords embedded: [list primary + supporting keywords used]
Chapter count: [number]
Sources cited: [count]
Topic tags selected: [3 tags with reasoning]
Description word count: [count]
```

Target description length: 200-350 words for long-form, under 200 characters for shorts.
