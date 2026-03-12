import { searchStockFootage } from '../src/services/archive-service.js';

const queries = [
  'UFO footage military',
  'nimitz encounter footage',
  'pentagon military briefing',
  'declassified government document',
];

for (const q of queries) {
  console.log(`\n=== "${q}" ===`);
  const results = await searchStockFootage(q, 3);
  if (results.length === 0) {
    console.log('  No results');
  }
  for (const r of results) {
    console.log(`  ${r.title}`);
    console.log(`    ${r.downloadUrl}`);
    console.log(`    Format: ${r.format}, Duration: ${r.durationSeconds ?? 'unknown'}s, Size: ${r.fileSizeBytes ? (r.fileSizeBytes / 1024 / 1024).toFixed(1) + 'MB' : 'unknown'}`);
  }
}
