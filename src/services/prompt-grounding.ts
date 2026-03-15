import { ApiError } from '../errors/index.js';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('prompt-grounding');

// ---------------------------------------------------------------------------
// Visual grounding for image prompts
//
// Each raw image cue from the script goes through:
//   1. Web search (Tavily) — find real visual reference for the subject
//   2. LLM rewrite (Claude Haiku) — produce a Flux-optimized prompt grounded
//      in what things actually look like
// ---------------------------------------------------------------------------

interface GroundingInput {
  imageCue: string;
  narration: string;
  topic: string;
  imageFramework: string;
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
    const response = await fetch('https://api.tavily.com/search', {
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

Your job: take a raw image cue from a video script, use the provided visual reference research to ground the description in reality, then output a single optimized Flux prompt.

## Your Process
1. Read the VISUAL REFERENCE RESEARCH to understand what the subject actually looks like — specific materials, colors, shapes, architectural details, clothing, equipment, landscape features
2. Read the NARRATION to understand what emotion and context the image must support
3. Rewrite the image cue with grounded visual details from the research, replacing vague descriptions with specific, accurate ones

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

async function rewriteWithClaude(
  imageCue: string,
  narration: string,
  topic: string,
  searchContext: string,
  imageFramework: string,
): Promise<string> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');

  // Extract the style/identity section from the image framework for context
  const identityMatch = imageFramework.match(/## Channel Visual Identity[\s\S]*?(?=## Color Palette|---)/);
  const paletteMatch = imageFramework.match(/## Color Palette[\s\S]*?(?=## Scene Categories|---)/);
  const channelContext = [
    identityMatch?.[0]?.trim() ?? '',
    paletteMatch?.[0]?.trim() ?? '',
  ].filter(Boolean).join('\n\n');

  const userMessage = `## TOPIC
${topic}

## NARRATION (what the viewer hears during this image)
${narration}

## RAW IMAGE CUE (rewrite this)
${imageCue}

## VISUAL REFERENCE RESEARCH (ground your rewrite in these real-world details)
${searchContext}

## CHANNEL STYLE CONTEXT
${channelContext}

Rewrite the image cue into an optimized Flux prompt. Ground it in the visual research — use specific real-world details (materials, colors, shapes, architecture) instead of vague descriptions. Keep under 55 words. Output ONLY the prompt.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: GROUNDING_SYSTEM_PROMPT,
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
  const { imageCue, narration, topic, imageFramework } = input;

  // Step 1: Search for visual reference
  const searchQuery = buildSearchQuery(imageCue, topic);
  log.info(`Searching: "${searchQuery.slice(0, 80)}"`);
  const searchContext = await searchVisualContext(searchQuery);

  // Step 2: LLM rewrite with grounded context
  log.info(`Grounding cue: "${imageCue.slice(0, 60)}..."`);
  const groundedPrompt = await rewriteWithClaude(imageCue, narration, topic, searchContext, imageFramework);

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
): Promise<Map<string, GroundingResult>> {
  const results = new Map<string, GroundingResult>();
  const DELAY_MS = 500; // gentle pacing between API calls

  log.info(`Grounding ${cues.length} image cues for topic: "${topic}"`);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    try {
      const result = await groundImagePrompt({
        imageCue: cue.imageCue,
        narration: cue.narration,
        topic,
        imageFramework,
      });
      results.set(cue.id, result);
    } catch (err) {
      // Non-fatal — fall back to original cue if grounding fails
      log.warn(`Grounding failed for cue ${i} (${cue.id}), using original: ${(err as Error).message}`);
      results.set(cue.id, {
        originalCue: cue.imageCue,
        groundedPrompt: cue.imageCue,
        searchContext: '',
      });
    }

    if (i < cues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  log.info(`Grounding complete: ${results.size}/${cues.length} cues processed`);
  return results;
}
