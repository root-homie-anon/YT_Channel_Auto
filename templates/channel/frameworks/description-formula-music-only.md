# Description Formula — {{CHANNEL_NAME}}

---

## Fixed Channel Hashtags

These appear on EVERY video (first 3 show above the title on YouTube):

```
{{FIXED_HASHTAGS — e.g. #channelname #genre1 #genre2}}
```

---

## Description Structure

```
[One-liner: atmospheric sentence capturing the visual + sonic mood]

[Summary: 1-2 sentences about what the listener will experience]

[Chapter markers — if multi-segment]

---
[CTA line]

[Hashtags]
```

---

## One-Liner Rules

- Single sentence, under 120 characters
- Names the environment and the sonic texture — not the genre
- Reads like a scene description, not a product listing
- Examples:
  - "{{ONE_LINER_EXAMPLE_1}}"
  - "{{ONE_LINER_EXAMPLE_2}}"
  - "{{ONE_LINER_EXAMPLE_3}}"

---

## Summary Rules

- 1-2 sentences max
- Mention the duration naturally
- Reference the sonic palette without genre-labeling
- If multi-segment, mention the number of scenes

---

## Chapter Marker Rules

- Only for multi-segment productions (2+ segments)
- First chapter must start at 0:00 (YouTube requirement)
- Use scene names from the title formula's Scene Name Pool
- Format: `0:00 Scene Name`
- YouTube requires minimum 3 chapters, minimum 10 seconds each

---

## CTA Line

Fixed for all videos:
```
{{CTA_LINE — e.g. "Subscribe for more. New sessions weekly."}}
```

---

## Tag Construction

Generate 10-15 tags per video from these sources:

**Fixed tags (every video):**
{{FIXED_TAGS — e.g. "channel name, genre1, genre2, electronic music, ambient mix"}}

**From music prompt:**
- Extract mood words
- Extract instrument references
- Add tempo bucket

**From image prompt:**
- Extract environment keywords
- Extract visual mood keywords

**Duration tags:**
- Add duration bucket: "1 hour mix", "3 hour ambient", etc.

All lowercase. Max 500 characters total.

---

## Topic-Specific Hashtag Construction

Generate 2-3 topic-specific hashtags beyond the fixed set:
- Pull from mood and environment keywords in prompts
- Specific beats generic
- Total hashtags per video: 5 max (3 fixed + 2 topic-specific)

---

## What This Formula Does NOT Do

- No shorts descriptions — music-only channels have no shorts
- No above-the-fold keyword strategy
- No SEO-first approach — ambient/music channels are served via browse and suggested
