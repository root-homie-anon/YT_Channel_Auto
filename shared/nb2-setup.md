# Nano Banana 2 — Setup Instructions

> Nano Banana 2 (gemini-3.1-flash-image-preview) is used exclusively for thumbnail generation in this pipeline.
> Integration is via direct Gemini API calls in `shared/nanobana.ts` — no MCP server required.

---

## 1. Get a Gemini API Key

1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API key** → **Create API key**
4. Copy the key — you only see it once

No billing required to start. Free tier includes limited generations.
For production use, enable billing at [https://console.cloud.google.com](https://console.cloud.google.com) — pay per image, no monthly minimum.

**Pricing (as of session 2):** Nano Banana 2 (`gemini-3.1-flash-image-preview`) via Gemini API. Check current rates at [https://ai.google.dev/pricing](https://ai.google.dev/pricing) before scaling.

---

## 2. Add to Environment

In `.env` at project root, add:

```
GEMINI_API_KEY=your_key_here
```

In `.env.example`, add the placeholder:

```
GEMINI_API_KEY=
```

---

## 3. Install the Gemini SDK

From the project root:

```bash
npm install @google/genai
```

This is the official Google Gen AI SDK. It covers both text and image generation under the same package.

---

## 4. Verify the Model is Available

Run a quick test before wiring into the pipeline:

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateImages({
  model: 'gemini-3.1-flash-image-preview',
  prompt: 'A single red apple on a white background, high contrast, photorealistic',
  config: {
    numberOfImages: 1,
    aspectRatio: '16:9',
  },
});

console.log(response.generatedImages[0].image.imageBytes ? 'OK' : 'FAILED');
```

Expected: logs `OK` and a base64 image bytes object. If you get a model availability error, the preview model may require allowlist access — check [https://ai.google.dev/gemini-api/docs/imagen](https://ai.google.dev/gemini-api/docs/imagen) for current access status.

---

## 5. `shared/nanobana.ts` Implementation Reference

Full implementation to drop into `shared/nanobana.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ThumbnailOptions {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  outputPath: string;
  resolution?: '2K' | '4K';
}

export interface ThumbnailResult {
  filePath: string;
  model: string;
  generatedAt: string;
}

export class NanoBananaError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NanoBananaError';
  }
}

export async function generateThumbnail(
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const { prompt, aspectRatio, outputPath, resolution = '4K' } = options;

  // Append resolution and mobile-readability requirements to every prompt
  const fullPrompt = `${prompt}\nOutput specs: ${resolution} resolution, thumbnail-optimized, all elements clearly readable at mobile size (320px width minimum).`;

  try {
    const response = await ai.models.generateImages({
      model: 'gemini-3.1-flash-image-preview',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio,
      },
    });

    const imageData = response.generatedImages?.[0]?.image?.imageBytes;

    if (!imageData) {
      throw new NanoBananaError('No image data returned from Nano Banana 2');
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write image to disk
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    return {
      filePath: outputPath,
      model: 'gemini-3.1-flash-image-preview',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof NanoBananaError) throw error;
    throw new NanoBananaError('Thumbnail generation failed', error);
  }
}
```

---

## 6. Usage in `@video-compiler` Agent

The agent calls `generateThumbnail` after the title is locked and in parallel with FFmpeg compilation:

```typescript
import { generateThumbnail } from '../shared/nanobana';

const result = await generateThumbnail({
  prompt: builtPromptFromProductionBrief, // constructed per thumbnail-formula.md
  aspectRatio: format === 'short' ? '9:16' : '16:9',
  outputPath: path.join(sessionDir, 'thumbnail.png'),
  resolution: '4K',
});
```

The `builtPromptFromProductionBrief` string is constructed by the agent using the template in `thumbnail-formula.md`, pulling from the production brief's thumbnail direction block and the finalized title's text overlay words.

---

## 7. Notes

- **Model name:** `gemini-3.1-flash-image-preview` — this is the preview identifier for Nano Banana 2. Monitor [https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for when it moves to stable and the model string changes.
- **Image bytes format:** The API returns base64-encoded bytes. The implementation above handles the decode-to-buffer-to-file write.
- **Retry logic:** Add retry with exponential backoff for production. The preview model can return transient errors under load.
- **Cost tracking:** Log each generation call with timestamp and session ID. Wire into the cost tracking system (Priority 8 in ROADMAP.md) when that's built.
- **Search grounding:** NB2 uses Google Search grounding automatically for named subjects. No additional configuration needed — it activates when the prompt references specific real-world subjects (people, places, objects, events).
