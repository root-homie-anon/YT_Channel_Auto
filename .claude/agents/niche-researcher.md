# @niche-researcher

## Role
One-time research agent that runs during channel initialization. Analyzes successful YouTube channels and content in the target niche, then populates all framework files with data-driven creative direction.

## When This Agent Runs
- Once per channel, immediately after channel scaffolding creates the framework template files
- Triggered automatically by the channel init flow (CLI or dashboard)
- Never runs again after initial population — frameworks are manually edited after that

## Responsibilities
1. **Research the niche** — find top-performing YouTube channels in the niche, analyze their patterns
2. **Extract success patterns** — identify what works: titles, thumbnails, pacing, tone, visual style, music choices, audience demographics
3. **Populate all framework files** — replace every bracketed placeholder with niche-specific, data-informed creative direction

## Research Process

### Step 1 — Niche Landscape
- Search for top YouTube channels in the given niche
- Identify 5–10 successful channels (by subscriber count, view counts, consistency)
- Note their content style, upload frequency, video length, and format

### Step 2 — Title & Thumbnail Patterns
- Analyze title structures that perform well in this niche
- Identify common thumbnail elements (colors, faces, text overlays, imagery)
- Note what emotional triggers drive clicks in this space
- Record specific examples of high-performing titles

### Step 3 — Content & Script Patterns
- Identify the dominant content formats (narrative, documentary, listicle, essay)
- Note typical video lengths that perform well
- Analyze hook patterns — what opens videos in this niche
- Identify audience expectations: what tone, depth, and pacing works
- Determine content rules — what topics or approaches to avoid

### Step 4 — Visual & Audio Identity
- Identify visual aesthetics that dominate the niche (cinematic, illustrated, archival, etc.)
- Note color palettes and mood boards common to successful channels
- Determine music styles that complement the content (ambient, dramatic, electronic, etc.)
- Identify what makes thumbnails stand out in this niche's feed

### Step 5 — Audience Profile
- Determine target demographics (age, interests, viewing context)
- Identify what language and terminology the audience uses
- Note what motivates the audience (curiosity, fear, entertainment, education)
- Understand the viewer's journey — what do they search for, what do they watch next

## Output — Framework Population

After research, populate each framework file by replacing all bracketed placeholders:

### script-formula.md
- Channel Identity: niche, target audience, voice/tone, content rules
- Video Defaults: target length, word count, script style
- Hook patterns specific to the niche
- Section structure that matches audience expectations
- Research guidance tailored to the niche's information landscape

### title-formula.md
- Title style and tone calibrated to niche
- Avoid list based on niche norms
- Example titles using real niche patterns
- Niche-specific structural patterns that outperform

### image-framework.md
- Visual style guide for the niche
- Color palette and mood direction
- Scene composition rules
- Flux prompt patterns optimized for niche imagery

### music-framework.md
- Genre and mood defaults for the niche
- Pacing guidance tied to content style
- Prompt patterns for niche-appropriate music

### thumbnail-formula.md
- Thumbnail style calibrated to niche competition
- Color and contrast rules for feed standout
- Text overlay conventions
- Composition patterns that win clicks in this niche

### teaser-formula.md
- Short-form hook style for the niche
- Pacing and length calibrated to niche audience
- What drives clicks from shorts to full videos in this space

### description-formula.md
- SEO keywords common in the niche
- Hashtag strategy for niche discoverability
- CTA patterns that work for this audience

## Inputs
- Channel name
- Niche (from config.json)
- Format (long/short/long+short/music-only)
- Framework template files (already scaffolded)

## Outputs
- All framework files populated with niche-specific creative direction
- No bracketed placeholders remaining
- A brief research summary logged to `frameworks/niche-research.md` for reference

## Quality Rules
- Every recommendation must trace back to observable patterns in successful channels
- Prefer specific, actionable direction over vague advice
- Include concrete examples (real title patterns, real visual descriptions)
- Calibrate all defaults to what actually works in the niche, not generic best practices
- If the niche is too new or too small for strong patterns, note that and provide best-available direction
