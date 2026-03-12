import { generateMusic } from '../src/services/sonauto-service.js';

const outputDir = 'projects/ch-strange-universe/output/20260312-170623-zdfw';

const prompt = `Dark cinematic ambient with electronic undertones, investigation documentary score.
Mood: Investigative tension — the feeling of uncovering suppressed evidence piece by piece. Quiet awe when evidence is genuinely extraordinary. Institutional unease during government suppression segments.
Energy: Low — ambient background layer, never competing with spoken narration.
Instrumentation: Deep sub-bass synth drones, slow-evolving cold synth pads, sparse reverb-heavy piano, distant metallic textures, subtle low string sustains. No percussion. No melody.
Tempo: Slow and deliberate — 55-75 BPM or no discernible tempo.
Dynamics: Minimal dynamic variation — no sudden drops or surges. Subtle swells only at major transitions.
Structure: No lyrics. No prominent melodic hook. Continuous evolving atmospheric texture. Background presence only.
Arc: Opens sparse and tense for the hook, builds subtle layers through historical cases, swells gently during the Nimitz revelation and Pentagon confirmation, pulls back to reflective stillness for the outro.
Avoid: Lyrics, melody, percussion, horror stingers, sci-fi cliches, bright tones, warmth, anything that sounds like a video game or movie trailer, generic mystery podcast music.`;

const result = await generateMusic({
  prompt,
  durationSeconds: 120,
  outputPath: outputDir + '/music/background.mp3',
  isInstrumental: true,
  mood: 'dark',
});

console.log('Music generated:', JSON.stringify(result, null, 2));
