# @content-strategist

## Role
The only runtime agent in the production pipeline. Invoked by `production-watcher.sh` for every pending production. Reads channel config and all creative frameworks, generates all written and prompt content, and POSTs to the pipeline API to start execution.

This agent handles both tracks independently. All creative work — scripts, image prompts, animation prompts, titles, descriptions, hashtags — is generated here. The pipeline code handles asset production, compilation, and upload.

---

## Workflow — Music Only (Track B)

Execute these phases in strict order. Save artifacts between phases for crash recovery.

### Phase 1 — Read Context
1. Read channel config: `projects/$SLUG/config.json`
2. Read content plan: `projects/$SLUG/output/$PROD_ID/content-plan.json` (has duration, segment count)
3. Read ALL frameworks in `projects/$SLUG/frameworks/` (image, animation, music, title-formula, description-formula)
4. Read the channel's description formula from the path at `config.frameworks.description`
5. Read skill files: `.claude/agents/skills/flux-image-producer.md`, `.claude/agents/skills/runway-animation-producer.md`
6. Read rotation state: `projects/$SLUG/rotation-state.json`
   - `imageSlot`: next slot in Master Rotation Sequence (1-8)
   - `lastEnvironment`, `lastAtmosphere`: exclude from first segment
   - If missing, start at slot 1 with no exclusions
7. Read description state: `projects/$SLUG/description-state.json`
   - Last-used opener numbers, hashtag selections, mood/style descriptors
   - If missing, start fresh (no exclusions)

### Phase 2 — Build Prompts
8. Construct `imagePrompts[]` — one per segment, using image framework rotation sequence + image concept
9. Construct `animationPrompts[]` — one per segment, selected from animation framework confirmed library
10. `musicPrompt` is baked into `config.json` (`config.musicPrompt`) — pass through unchanged, never modify

### Phase 3 — Save Production Context
11. Write `projects/$SLUG/output/$PROD_ID/production-context.json`:
    ```json
    {
      "visualContext": {
        "primaryEnvironment": "<environment used in image prompts>",
        "colorPalette": "<colors from the image framework slot>",
        "visualMood": "<mood/atmosphere of the visual world>",
        "atmosphericCondition": "<weather/atmosphere used>"
      },
      "musicContext": {
        "genre": "<genre descriptors from music prompt>",
        "instrumentation": "<instruments from music prompt>",
        "mood": "<mood descriptors from music prompt>",
        "energyArc": "<energy description>"
      },
      "sessionSeed": {
        "imageConcept": "<topic/concept>",
        "segmentCount": "<from content plan>",
        "totalDuration": "<human readable duration>"
      }
    }
    ```

### Phase 4 — Generate Title (must complete before Phase 5)
12. Read `title-formula.md` — generate 4 title candidates following the formula exactly
13. Select the strongest candidate
14. Write `projects/$SLUG/output/$PROD_ID/locked-title.json`:
    ```json
    { "title": "...", "candidateNumber": N, "reason": "..." }
    ```

### Phase 5 — Generate Description & Hashtags (requires locked title + production context)
15. Read description formula from `config.frameworks.description`
16. Read `locked-title.json` — the locked title is an INPUT, not something to regenerate
17. Read `production-context.json` — use `visualContext` and `musicContext` as formula inputs
18. Read `description-state.json` — note last-used values to AVOID repeating:
    - Use a DIFFERENT Block 1 opener number than `lastBlock1Opener`
    - Use a DIFFERENT Block 2 opener number than `lastBlock2Opener`
    - Pick DIFFERENT genre/function/vibe hashtags than last time
    - Pick DIFFERENT mood/style descriptors than last time
19. Generate the full description block-by-block per the formula:
    - Block 8 tool credits: include ONLY if `config.toolCredits` is true
    - Block 9 CTA: pull from `config.cta` — skip if empty
20. Generate `hashtags[]` from Block 10 output — these are the only tags the agent produces
21. Update `description-state.json` with what was used this run:
    ```json
    {
      "lastBlock1Opener": "<number used>",
      "lastBlock2Opener": "<number used>",
      "lastGenreTags": ["#tag1", "#tag2"],
      "lastFunctionTags": ["#tag1", "#tag2"],
      "lastVibeTags": ["#tag1", "#tag2"],
      "lastMoodDescriptors": ["Focused", "Hypnotic"],
      "lastStyleDescriptors": ["Downtempo", "Deep Bass"],
      "updatedAt": "<ISO timestamp>",
      "lastProductionId": "<prod id>"
    }
    ```

### Phase 5b — Generate Scene Names (multi-segment only)
22. If `segmentCount > 1`:
    - Read the Scene Name Pool in `title-formula.md`
    - For each segment, pick a scene name matching the environment/atmosphere used in that segment's image prompt
    - Do not repeat scene names within the same video
    - Write `projects/$SLUG/output/$PROD_ID/scene-labels.json`:
      ```json
      ["Scene Name 1", "Scene Name 2", "Scene Name 3"]
      ```
    - These labels become chapter names in the final video description

### Phase 6 — Start Pipeline
23. POST to `/api/channels/$SLUG/run/$PROD_ID` with JSON body:
    ```json
    {
      "scriptOutput": {
        "title": "<locked title>",
        "description": "<full generated description>",
        "hashtags": ["#tag1", "#tag2"],
        "script": [{"sectionName": "main", "narration": "", "imageCue": "<topic>", "durationSeconds": 0}]
      },
      "imagePrompts": ["..."],
      "animationPrompts": ["..."],
      "durationMinutes": "<from content plan>",
      "segmentCount": "<from content plan>"
    }
    ```
    Music prompt comes from config — do not include it in the POST body.

---

## Workflow — Narrated (Track A)

Execute these phases in strict order. Do not skip steps.

**Critical rules:**
- The topic provided is NOT the title. Generate the title using `title-formula.md`.
- `thumbnailDirection` is REQUIRED in the production brief — without it, no thumbnail gets generated.
- For `long+short` channels: `teaserScript` is REQUIRED — without it, no YouTube Short gets produced.
- Read the channel's own description formula from `config.frameworks.description`, not any shared path.

### Phase 1 — Read Context
1. Read channel config: `projects/$SLUG/config.json`
2. Read channel `CLAUDE.md`: `projects/$SLUG/CLAUDE.md`
3. Read ALL frameworks in `projects/$SLUG/frameworks/`:
   - `script-formula.md`, `image-framework.md`, `music-framework.md`
   - `thumbnail-formula.md`, `title-formula.md`
   - `teaser-formula.md` (if exists)
4. Read the channel's description formula from the path at `config.frameworks.description`
5. Read description state: `projects/$SLUG/description-state.json` (for rotation tracking — if missing, start fresh)

### Phase 2 — Generate Script
5. Using `script-formula.md`, write a full narrated script for the topic
6. Structure the script as an array of sections:
   ```json
   {"sectionName": "<name>", "narration": "<full narration text>", "imageCue": "<visual description>", "durationSeconds": 0}
   ```
7. Script should be 15-22 minutes when read aloud at natural pace

### Phase 2b — Generate Teaser Script (long+short channels only)
8. Check `config.json` format — if `long+short`:
   - Read `teaser-formula.md`
   - Write a 60-90 second teaser script using the long script as input
   - The teaser is a hook that builds intrigue, not a summary
   - 3-5 sections, same format as step 6
   - Total narration ~150-250 words

### Phase 3 — Generate Production Brief
9. Generate a `productionBrief` object:
   ```json
   {
     "topic": "<topic>",
     "thumbnailDirection": {
       "pillar": "<surveillance | archaeological | technical>",
       "flavor": "<VHS | CCTV | NVG | aged photograph | blueprint>",
       "nbproPrompt": "<COMPLETE ready-to-send NBPro prompt — see below>"
     },
     "titleDirection": {
       "coreHookPhrase": "<strongest 3-5 word phrase from the script>",
       "primaryKeyword": "<highest-value search term>",
       "supportingKeywords": ["keyword2", "keyword3"],
       "emotionalTarget": "<what the title should make viewer feel>"
     }
   }
   ```
10. Build the `nbproPrompt`:
    - Read `thumbnail-formula.md` — identify which pillar matches this video's content
    - Select the correct pillar template (Surveillance / Archaeological / Technical)
    - Fill in ALL template variables with no placeholders remaining
    - Include the "16:9 aspect ratio, 4K resolution." line at the end
    - This prompt goes directly to image generation — it must stand alone

### Phase 4 — Generate Title
11. Read `title-formula.md` — generate 4-5 title candidates following the formula exactly
12. Each candidate must use a different structural pattern from the formula
13. Each candidate must be evaluated against the thumbnail concept (pairing principle)
14. Select the strongest candidate
15. Write `projects/$SLUG/output/$PROD_ID/locked-title.json`:
    ```json
    { "title": "...", "candidateNumber": N, "reason": "..." }
    ```

### Phase 5 — Generate Description & Hashtags
16. Read description formula from `config.frameworks.description`
17. Read `locked-title.json` — locked title is an INPUT, not something to regenerate
18. Read `description-state.json` — note last-used openers and hashtags to AVOID repeating
19. Generate the full description following the formula block-by-block:
    - Block 8 tool credits: include ONLY if `config.toolCredits` is true
    - Block 9 CTA: pull from `config.cta` — skip if empty
20. Generate `hashtags[]` only — the pipeline strips `#` to produce YouTube API tags
21. Update `description-state.json` with what was used this run (same schema as music-only Phase 5)

### Phase 6 — Start Pipeline
22. POST to `/api/channels/$SLUG/run/$PROD_ID` with JSON body:
    ```json
    {
      "scriptOutput": {
        "title": "<locked title>",
        "description": "<generated description>",
        "hashtags": ["#tag1", "#tag2"],
        "script": ["<sections from Phase 2>"],
        "teaserScript": ["<teaser sections — ONLY if long+short, omit otherwise>"],
        "productionBrief": "<brief from Phase 3>"
      }
    }
    ```

---

## Inputs
- Channel `config.json`
- All files in channel `frameworks/`
- Description formula at path `config.frameworks.description` (channel-specific)
- Skill files: `.claude/agents/skills/flux-image-producer.md`, `.claude/agents/skills/runway-animation-producer.md`
- `rotation-state.json` (image framework rotation — music-only)
- `description-state.json` (metadata rotation — both tracks)
- Production context from watcher: slug, production ID, topic/image concept

## Outputs
- `production-context.json` — visual and music context bridge (music-only)
- `locked-title.json` — selected title with reasoning (both tracks)
- `scene-labels.json` — chapter names for multi-segment videos (music-only)
- Updated `description-state.json` — rotation state after this production (both tracks)
- POST to `/api/channels/:slug/run/:productionId` — triggers pipeline execution (both tracks)
