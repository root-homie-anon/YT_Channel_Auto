import { ApiError } from '../errors/index.js';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { fetchWithTimeout } from '../utils/fetch-helpers.js';

const log = createLogger('prompt-grounding');

// ---------------------------------------------------------------------------
// Visual grounding for image prompts
//
// Each raw image cue from the script goes through:
//   1. Web search (Tavily) — find real visual reference for the subject
//   2. LLM rewrite (Claude Haiku) — produce a Flux-optimized prompt grounded
//      in what things actually look like
// ---------------------------------------------------------------------------

export type GroundingMode = 'visual' | 'emotional';

interface GroundingInput {
  imageCue: string;
  narration: string;
  topic: string;
  imageFramework: string;
  mode?: GroundingMode;
  previousContext?: {
    narration: string;
    cue: string;
    groundedPrompt: string;
  };
}

interface GroundingResult {
  originalCue: string;
  groundedPrompt: string;
  searchContext: string;
}

// -- Tavily Web Search ------------------------------------------------------

interface TavilyResult {
  title: string;
  content: string;
  url: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

async function searchVisualContext(query: string): Promise<string> {
  const apiKey = requireEnv('TAVILY_API_KEY');

  try {
    const response = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(`Tavily search failed: ${response.status} ${body}`, 'tavily', response.status);
    }

    const data = (await response.json()) as TavilyResponse;
    if (!data.results?.length) {
      return 'No visual references found.';
    }

    // Compile the top results into a concise context block
    return data.results
      .slice(0, 5)
      .map((r) => `- ${r.title}: ${r.content.slice(0, 300)}`)
      .join('\n');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    log.warn(`Tavily search failed, proceeding without grounding: ${(err as Error).message}`);
    return 'Search unavailable — use best knowledge of the subject.';
  }
}

function buildSearchQuery(imageCue: string, topic: string): string {
  // Extract the key subject from the cue for a focused visual search
  // Strip generic scene descriptors, keep the specific subject
  const genericTerms = /\b(dark|deep|heavy|faint|vast|single|lone|massive|distant|cold|warm|pale|bright|shadowed?|shadows?|black|silhouett\w*)\b/gi;
  const subject = imageCue.replace(genericTerms, '').replace(/\s{2,}/g, ' ').trim();

  // Build a query that targets visual/appearance information
  const shortSubject = subject.split(',')[0].trim();
  return `${shortSubject} ${topic} visual appearance what it looks like`;
}

// -- Claude Haiku LLM -------------------------------------------------------

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
}

const GROUNDING_SYSTEM_PROMPT = `You are a visual research assistant that rewrites image descriptions into optimized prompts for the Flux 2 Pro AI image generator.

Your job: take a raw image cue from a video script, validate that it matches the narration, ground it in visual research, and output a single optimized Flux prompt.

## CRITICAL — Narration Alignment (Rule Zero)
The image MUST depict what the viewer is hearing. Before rewriting, check:
1. Read the NARRATION and identify the most concrete, vivid noun or action in it
2. Check whether the image cue is a direct visual translation of that thing
3. If the cue is disconnected from the narration (e.g., narration talks about "press conference" but cue shows "empty corridor," or narration says "flying saucer reports" but cue shows "parked planes"), you MUST REPLACE the cue with a scene that depicts what the narration actually describes
4. Self-check: if someone saw only the image with no audio, could they guess what the narration is about? If not, the cue is wrong — fix it

A generic atmospheric mood shot that is merely "themed" around the topic is a FAILURE. The image must illustrate the specific content of the narration.

## Previous Image Context
You will be given the PREVIOUS section's narration and grounded prompt. Use this to:
1. **Avoid repetition** — if the previous image already shows a radar room, do NOT default to another radar room. Find the next visual beat.
2. **Build continuity** — the previous narration tells you what the viewer just heard. The current narration continues or contrasts that. Use this flow to pick the right beat.
3. **Advance the story visually** — each image should feel like the next panel in a graphic novel, not a repeat of the last one.

## Your Process
1. Validate the cue against the narration (Rule Zero above) — replace if disconnected
2. Read the VISUAL REFERENCE RESEARCH to understand what the subject actually looks like — specific materials, colors, shapes, architectural details, clothing, equipment, landscape features
3. Rewrite the (validated or replaced) cue with grounded visual details from the research, replacing vague descriptions with specific, accurate ones

## Flux Prompt Rules (MUST follow)
- Maximum 55 words (leave room for the style tag that gets appended after your output)
- One subject, one environment, one mood — simple compositions only
- NO readable text, headlines, labels, dates, stamps, or specific words
- NO screens, monitors, radar displays, HUD overlays, instrument readouts, UI elements
- NO split views, side-by-side, picture-in-picture, data overlays
- NO named real people or specific military insignia
- If the cue describes any of the above, REINTERPRET it as a pure physical scene
- Describe what a comic book artist would draw, not what a photographer would capture
- Favor bold compositions: strong contrast, dramatic scale, one bright element in darkness

## Output Format
Return ONLY the rewritten prompt text. No explanation, no quotes, no labels. Just the prompt.`;

const EMOTIONAL_GROUNDING_SYSTEM_PROMPT = `You are an emotional cinematographer that converts narrative image cues into Flux 2 Pro prompts driven by the emotional register of the narration.

Your job: read the narration, identify the dominant emotion, and produce a Flux prompt that makes the viewer FEEL what they're hearing — using the correct Flux prompt structure.

## CRITICAL — Emotional Alignment (Rule Zero)
The image MUST match the emotional state of the narration at this exact moment. Before rewriting:
1. Read the NARRATION and identify the emotional register — power, menace, cruelty, aftermath, isolation, indifference, calculation, confrontation
2. Identify the SHIFT — has the emotion changed from the previous section?
3. The image cue describes a SPECIFIC story moment — keep that specificity. Your job is to cinematograph it.
4. Self-check: if someone saw only this image with no audio, would they feel the same thing? If not, fix it.

## Flux Prompt Structure — Token Order (MUST follow)
Flux weights earlier tokens more heavily. Build in this exact order:

[SUBJECT + orientation + camera angle + scale] →
[TWO visual universe references from the channel framework] →
[Atmosphere color + hex + condition] →
[Primary light color + hex + source] →
[Accent color + hex + detail — only if scene warrants it] →
[True black #000000 + what it anchors] →
[Sony A7R IV + lens from framework + "fine grain, slight underexposure"] →
[Atmosphere condition — fog, rain, stillness, etc.] →
[Mood close — 3-6 words] →
[16:9 cinematic frame]

## Previous Image Context
You will be given the PREVIOUS section's prompt. Use this to:
1. **Shift the emotional register** visually when the narration shifts
2. **Avoid repeating** the same composition, lens, or reference pairing
3. **Build emotional arc** — the sequence should feel like a film, not a slideshow

## Hard Rules
- 60–90 words — under 40 is too thin, over 110 dilutes early tokens
- ALWAYS include 2 visual universe references from the channel's approved list
- ALWAYS include hex color codes for atmosphere, light, and accent
- ALWAYS include true black #000000
- ALWAYS include camera body + lens + "fine grain, slight underexposure"
- ALWAYS close with mood line + "16:9 cinematic frame"
- NO generic quality boosters (highly detailed, masterpiece, 4K, stunning)
- NO negative prompts — reframe positively
- NO stacked unanchored adjectives — every modifier attaches to a noun
- NO readable text, screens, UI elements, data overlays
- NO visible human faces — silhouettes, back-turned, hands only
- One subject, one environment, one mood per prompt

## Output Format
Return ONLY the prompt text. No explanation, no quotes, no labels.`;

async function rewriteWithClaude(
  imageCue: string,
  narration: string,
  topic: string,
  searchContext: string,
  imageFramework: string,
  previousContext?: GroundingInput['previousContext'],
  mode: GroundingMode = 'visual',
): Promise<string> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');

  // Extract the style/identity section from the image framework for context
  const identityMatch = imageFramework.match(/## Channel Visual Identity[\s\S]*?(?=## Color Palette|---)/);
  const paletteMatch = imageFramework.match(/## Color Palette[\s\S]*?(?=## Scene Categories|---)/);
  const channelContext = [
    identityMatch?.[0]?.trim() ?? '',
    paletteMatch?.[0]?.trim() ?? '',
  ].filter(Boolean).join('\n\n');

  const previousBlock = previousContext
    ? `## PREVIOUS SECTION (for context and to avoid repetition)
PREVIOUS NARRATION: ${previousContext.narration}
PREVIOUS IMAGE PROMPT: ${previousContext.groundedPrompt}

Do NOT repeat the same scene, setting, or composition as the previous image. Advance the visual story.

`
    : '';

  const userMessage = mode === 'emotional'
    ? `## TOPIC
${topic}

${previousBlock}## NARRATION (what the viewer hears during this image)
${narration}

## RAW IMAGE CUE (rewrite this into a Flux prompt)
${imageCue}

## CHANNEL IMAGE FRAMEWORK (style rules, approved references, hex palette, lens guide)
${imageFramework}

Identify the dominant emotion in the narration. Cinematograph the image cue using the Flux prompt structure. Follow the token order exactly. Use references, hex codes, camera specs, and mood close from the framework. 60-90 words. Output ONLY the prompt.`
    : `## TOPIC
${topic}

${previousBlock}## NARRATION (what the viewer hears during this image)
${narration}

## RAW IMAGE CUE (rewrite this)
${imageCue}

## VISUAL REFERENCE RESEARCH (ground your rewrite in these real-world details)
${searchContext}

## CHANNEL STYLE CONTEXT
${channelContext}

Rewrite the image cue into an optimized Flux prompt. Ground it in the visual research — use specific real-world details (materials, colors, shapes, architecture) instead of vague descriptions. Keep under 55 words. Output ONLY the prompt.`;

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: mode === 'emotional' ? EMOTIONAL_GROUNDING_SYSTEM_PROMPT : GROUNDING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }] as ClaudeMessage[],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(`Claude API failed: ${response.status} ${body}`, 'anthropic', response.status);
  }

  const data = (await response.json()) as ClaudeResponse;
  const text = data.content.find((c) => c.type === 'text')?.text?.trim();

  if (!text) {
    throw new ApiError('Claude returned no text content', 'anthropic');
  }

  return text;
}

// -- Public API -------------------------------------------------------------

/**
 * Ground a single image cue: web search for visual context, then LLM rewrite.
 */
export async function groundImagePrompt(input: GroundingInput): Promise<GroundingResult> {
  const { imageCue, narration, topic, imageFramework, previousContext, mode = 'visual' } = input;

  // Step 1: Search for visual reference (skip for emotional mode — fiction doesn't need web research)
  let searchContext: string;
  if (mode === 'emotional') {
    log.info(`Emotional grounding (no search): "${imageCue.slice(0, 60)}..."`);
    searchContext = '';
  } else {
    const searchQuery = buildSearchQuery(imageCue, topic);
    log.info(`Searching: "${searchQuery.slice(0, 80)}"`);
    searchContext = await searchVisualContext(searchQuery);
  }

  // Step 2: LLM rewrite — visual mode grounds in research, emotional mode grounds in narrative feeling
  log.info(`Grounding cue (${mode}): "${imageCue.slice(0, 60)}..."`);
  const groundedPrompt = await rewriteWithClaude(imageCue, narration, topic, searchContext, imageFramework, previousContext, mode);

  // Enforce word limit (safety net — LLM should already respect it)
  const words = groundedPrompt.split(/\s+/).filter(Boolean);
  const trimmed = words.length > 55 ? words.slice(0, 55).join(' ') : groundedPrompt;

  log.info(`Grounded (${words.length}w): "${trimmed.slice(0, 80)}..."`);

  return {
    originalCue: imageCue,
    groundedPrompt: trimmed,
    searchContext,
  };
}

/**
 * Ground all image cues for a production run.
 * Processes sequentially to avoid rate limits, with a short delay between calls.
 */
export async function groundBatchPrompts(
  cues: Array<{ id: string; imageCue: string; narration: string }>,
  topic: string,
  imageFramework: string,
  mode: GroundingMode = 'visual',
): Promise<Map<string, GroundingResult>> {
  const results = new Map<string, GroundingResult>();
  const DELAY_MS = 500; // gentle pacing between API calls

  log.info(`Grounding ${cues.length} image cues for topic: "${topic}"`);

  let previousContext: GroundingInput['previousContext'] | undefined;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    try {
      const result = await groundImagePrompt({
        imageCue: cue.imageCue,
        narration: cue.narration,
        topic,
        imageFramework,
        mode,
        ...(previousContext ? { previousContext } : {}),
      });
      results.set(cue.id, result);

      // Track for next iteration
      previousContext = {
        narration: cue.narration,
        cue: cue.imageCue,
        groundedPrompt: result.groundedPrompt,
      };
    } catch (err) {
      // Non-fatal — fall back to original cue if grounding fails
      log.warn(`Grounding failed for cue ${i} (${cue.id}), using original: ${(err as Error).message}`);
      results.set(cue.id, {
        originalCue: cue.imageCue,
        groundedPrompt: cue.imageCue,
        searchContext: '',
      });
      // Still update previous context with the fallback
      previousContext = {
        narration: cue.narration,
        cue: cue.imageCue,
        groundedPrompt: cue.imageCue,
      };
    }

    if (i < cues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  log.info(`Grounding complete: ${results.size}/${cues.length} cues processed`);
  return results;
}
