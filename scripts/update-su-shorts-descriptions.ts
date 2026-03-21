import { resolve } from 'path';
import { updateVideoMetadata } from '../src/services/youtube-service.js';

const OAUTH_PATH = resolve('projects/ch-strange-universe/.youtube-oauth.json');

// Shorts description formula:
// 1-2 lines above the fold (specific claim from the short)
// CTA: "Full investigation on the channel."
// NO hashtags in body — passed separately
// 5 hashtags: #strangeuniverse #ufo + 3 topic

const shorts = [
  {
    ytId: '9vSnkDTX3ag',
    title: "The USSR's Secret UFO Program They Ran for 13 Years",
    description:
      `In 1982, every nuclear launch indicator inside a Soviet missile base activated — while a massive UFO hovered overhead.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#sovietufo', '#militaryufo', '#declassified'],
  },
  {
    ytId: 'PRdOWZwaWR8',
    title: 'The USSR Ran the Largest UFO Hunt in History',
    description:
      `A UFO the size of a five-story building hovered over a Soviet nuclear missile base in 1982. The launch system activated on its own.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#sovietufo', '#coldwar', '#uapdisclosure'],
  },
  {
    ytId: 'dgx-a8GWdDc',
    title: 'The USSR Ran the Largest UFO Hunt in History',
    description:
      `In 1982, a UFO the size of a five-story building hovered over a Soviet nuclear missile base — and the launch system activated without human input.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#sovietufo', '#nuclearsecurity', '#militaryufo'],
  },
  {
    ytId: 'lHjyLN_T0KM',
    title: 'The Soviet UFO Program That Nearly Started WW3',
    description:
      `A Soviet nuclear missile base recorded every launch indicator activating while a massive unidentified object hovered directly above it.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#sovietufo', '#coldwar', '#declassified'],
  },
  {
    ytId: 'ToQS7v2OP90',
    title: 'A Cult Built a Machine to Prove Earth Is Hollow. It Worked.',
    description:
      `In 1897, a cult leader built a twelve-foot brass machine on a Florida beach. The measurements it returned should have been impossible.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#hollowearth', '#concaveearth', '#fringescience'],
  },
  {
    ytId: 'WGrJioc6MDs',
    title: "UFOs Over the White House: Why the Pentagon's Story Fell Apart",
    description:
      `In 1952, seven unknown objects appeared on radar directly over the White House. Fighter jets were scrambled. The objects vanished — then came back.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#washingtonufo', '#1952ufo', '#pentagon'],
  },
  {
    ytId: 'Vv9VHp3jMLs',
    title: "Operation Highjump: Admiral Byrd's Suppressed Antarctic Warning",
    description:
      `In 1947, the US Navy sent 4,700 troops, an aircraft carrier, and thirteen warships to Antarctica. They came back early — and Admiral Byrd's warning was buried.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#operationhighjump', '#admiralbyrd', '#antarctica'],
  },
  {
    ytId: 'wnyw6RLuG6c',
    title: 'The Genetic Blueprint Hidden in Sumerian Clay Tablets',
    description:
      `In 2012, scientists learned how to cut and rewrite DNA at any location they chose. The oldest creation texts on Earth describe something disturbingly similar — written 4,000 years earlier.\n\nFull investigation on the channel.\n\n` +
      `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.\n` +
      `What do you think? Drop your take in the comments.\n\n` +
      `© Strong Tower Media LLC – All rights reserved.`,
    hashtags: ['#strangeuniverse', '#ufo', '#anunnaki', '#crispr', '#sumerianmyth'],
  },
];

async function main(): Promise<void> {
  for (const short of shorts) {
    try {
      await updateVideoMetadata(OAUTH_PATH, short.ytId, {
        description: short.description,
        hashtags: short.hashtags,
      });
      console.log(`✓ Updated short: ${short.ytId} — ${short.title}`);
    } catch (err) {
      console.error(`✗ Failed: ${short.ytId} — ${(err as Error).message}`);
    }
  }
  console.log('\nDone.');
}

main();
