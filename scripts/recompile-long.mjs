import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { compileLongFormVideo } from '../src/services/ffmpeg-service.js';

const outputDir = resolve('projects/ch-strange-universe/output/20260312-170623-zdfw');
const manifest = JSON.parse(readFileSync(join(outputDir, 'asset-manifest.json'), 'utf-8'));
const scriptOutput = JSON.parse(readFileSync(join(outputDir, 'script-output.json'), 'utf-8'));

console.log('Recompiling long-form with new music...');
const result = await compileLongFormVideo({ outputDir, manifest, sections: scriptOutput.script, resolution: '1920x1080' });
console.log('Done:', JSON.stringify(result, null, 2));
