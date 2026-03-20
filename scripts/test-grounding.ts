import { groundBatchPrompts } from '../src/services/prompt-grounding.js';
import { readJsonFile } from '../src/utils/file-helpers.js';
import { loadFramework } from '../src/utils/config-loader.js';
import { ScriptOutput } from '../src/types/index.js';
import { join } from 'path';

async function main(): Promise<void> {
  const outputDir = 'projects/ch-strange-universe/output/20260316-001615-1llk';
  const scriptOutput = await readJsonFile<ScriptOutput>(join(outputDir, 'script-output.json'));
  const channelDir = 'projects/ch-strange-universe';
  const imageFramework = await loadFramework(channelDir, 'frameworks/image-framework.md');

  const topic = 'UFOs Over Washington DC — 1952';

  const cues = scriptOutput.script.map((section, i) => ({
    id: `section-${i}`,
    imageCue: section.imageCue,
    narration: section.narration,
  }));

  console.log(`Processing ${cues.length} cues through grounding...\n`);

  const results = await groundBatchPrompts(cues, topic, imageFramework);

  for (let i = 0; i < scriptOutput.script.length; i++) {
    const section = scriptOutput.script[i];
    const result = results.get(`section-${i}`);
    console.log(`[${i}] ${section.sectionName}`);
    console.log(`  NARRATION: ${section.narration.slice(0, 120)}...`);
    console.log(`  OLD CUE:   ${section.imageCue}`);
    console.log(`  NEW PROMPT: ${result?.groundedPrompt ?? 'FAILED'}`);
    console.log();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
