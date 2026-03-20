import 'dotenv/config';
import { generateThumbnailNBPro, loadSystemInstruction } from '../src/services/nanobana-service.js';
import { readFile, writeFile } from 'fs/promises';

const outputDir = process.argv[2];
if (!outputDir) {
  console.error('Usage: npx tsx scripts/gen-thumbnail.ts <outputDir>');
  process.exit(1);
}

async function main(): Promise<void> {
  const scriptOutput = JSON.parse(await readFile(outputDir + '/script-output.json', 'utf-8'));
  const prompt = scriptOutput.productionBrief?.thumbnailDirection?.nbproPrompt;
  if (!prompt) {
    // Fallback
    const firstCue = scriptOutput.script[0]?.imageCue ?? '';
    const topic = scriptOutput.productionBrief?.topic ?? scriptOutput.title;
    console.log('No nbproPrompt — using fallback');
  }

  const siPath = 'projects/ch-strange-universe/system-instructions/thumbnail.md';
  const systemInstruction = await loadSystemInstruction(siPath);

  console.log('Generating thumbnail...');
  const result = await generateThumbnailNBPro({
    prompt,
    aspectRatio: '16:9',
    outputPath: outputDir + '/thumbnail.png',
    resolution: '4K',
    systemInstruction,
    model: 'gemini-3-pro-image-preview',
    generationSettings: { topP: 0.75, maxOutputTokens: 4000, groundingEnabled: true },
  });
  console.log('Thumbnail generated:', result.filePath);

  const comp = JSON.parse(await readFile(outputDir + '/compilation-result.json', 'utf-8'));
  comp.thumbnailPath = result.filePath;
  await writeFile(outputDir + '/compilation-result.json', JSON.stringify(comp, null, 2));
  console.log('Updated compilation-result.json');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
