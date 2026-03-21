/**
 * Update YouTube descriptions and hashtags for all Strange Universe videos
 * to conform to the new description formula.
 *
 * Usage: npx tsx scripts/update-su-descriptions.ts
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const OAUTH_PATH = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/.youtube-oauth.json'
);

// Static blocks
const CTA = `Subscribe for weekly investigations into the world's most credible UFO cases and hidden history.
What do you think? Drop your take in the comments.`;

const CREDITS = `🎵 Music: Stable Audio 2.5
🖼️ Visuals: Flux
🎙️ Narration: ElevenLabs`;

const COPYRIGHT = `© Strong Tower Media LLC – All rights reserved.
All content is original and produced by Strong Tower Media LLC using AI tools.
Unauthorized reuploads or modifications are not permitted.`;

interface ScriptSection {
  sectionName: string;
  narration: string;
  imageCue: string;
  durationSeconds: number;
}

interface ScriptOutput {
  title: string;
  description: string;
  script: ScriptSection[];
}

interface CompilationResult {
  durationSeconds: number;
}

interface VideoUpdate {
  ytId: string;
  title: string;
  dir: string;
  aboveFold: string;
  chapters: string;
  sources: string;
  hashtags: string[];
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function roundTo5(seconds: number): number {
  return Math.round(seconds / 5) * 5;
}

/**
 * Group granular sections into logical chapters based on section name prefixes.
 */
function groupSections(
  sections: ScriptSection[]
): { label: string; startSec: number }[] {
  const groups: { label: string; totalDur: number }[] = [];
  let currentPrefix = '';

  for (const s of sections) {
    // Extract the logical group from the section name
    // e.g., BODY_PETRO_1 -> BODY_PETRO, INTRO_1 -> INTRO, HOOK -> HOOK
    const parts = s.sectionName.split('_');
    let prefix: string;

    // Determine logical group
    if (
      parts[0] === 'HOOK' ||
      parts[0] === 'CTA' ||
      parts[0] === 'REHOOK' ||
      s.sectionName.startsWith('BODY_REHOOK') ||
      s.sectionName.startsWith('OUTRO_CTA')
    ) {
      // These get merged into adjacent groups
      if (groups.length > 0) {
        groups[groups.length - 1].totalDur += s.durationSeconds;
        continue;
      }
      prefix = s.sectionName;
    } else if (parts.length >= 3 && parts[0] === 'BODY') {
      // BODY_TOPIC_N -> group by BODY_TOPIC
      prefix = `${parts[0]}_${parts[1]}`;
    } else if (parts.length >= 2 && !isNaN(Number(parts[parts.length - 1]))) {
      // INTRO_1, BONUS_1, OUTRO_1 -> group by first part
      prefix = parts[0];
    } else {
      prefix = s.sectionName;
    }

    if (prefix === currentPrefix && groups.length > 0) {
      groups[groups.length - 1].totalDur += s.durationSeconds;
    } else {
      groups.push({ label: prefix, totalDur: s.durationSeconds });
      currentPrefix = prefix;
    }
  }

  // Build cumulative timestamps
  const chapters: { label: string; startSec: number }[] = [];
  let cumulative = 0;
  for (const g of groups) {
    chapters.push({ label: g.label, startSec: roundTo5(cumulative) });
    cumulative += g.totalDur;
  }
  // First chapter must be 0:00
  if (chapters.length > 0) {
    chapters[0].startSec = 0;
  }

  return chapters;
}

// All video definitions with custom above-the-fold, chapter labels, sources, and hashtags
const VIDEOS: VideoUpdate[] = [
  {
    ytId: '_xQYOy0TSFU',
    title: "The USSR's Secret UFO Program They Ran for 13 Years",
    dir: '20260312-031139-1x5x',
    aboveFold: `The Soviet Union ran one of the largest classified UFO investigation programs in history — a 13-year operation codenamed Setka that most of the world has never heard of. This investigation walks through declassified military reports, nuclear base incidents, and underwater encounters that Soviet personnel documented across the Cold War. The Petrozavodsk event of 1977 triggered it all — and what followed rewrote Soviet military protocol.`,
    chapters: `0:00 The Nuclear Incident
0:25 Inside the Soviet UFO Landscape
1:30 The Petrozavodsk Event
4:00 Setka: The Secret Program
6:35 The Nuclear Base Encounter
9:10 Underwater Objects
11:25 The Kapustin Yar Files
13:20 What They Never Explained
14:35 The Aftermath`,
    sources: `Sources & References:
• Setka program — Soviet Ministry of Defense classified directive, 1978
• Petrozavodsk incident, September 20, 1977 — TASS wire reports and Soviet Academy of Sciences investigation
• Usovo nuclear base incident, October 4, 1982 — declassified military communications
• Soviet Navy USO files — compiled by researcher Paul Stonehill
• Kapustin Yar military test range sightings — Soviet Air Defense archives`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#sovietufo',
      '#coldwar',
      '#declassified',
    ],
  },
  {
    ytId: 'aoRZselAdBE',
    title: 'The USSR Ran the Largest UFO Hunt in History',
    dir: '20260312-043234-3frh',
    aboveFold: `The Soviet Union's classified UFO investigation program, Setka, collected thousands of military reports over more than a decade — and none of it was made public until the USSR collapsed. This investigation reconstructs the program from declassified defense files, covering nuclear site encounters, undersea anomalies, and the political machinery that kept it buried. What the Soviets tracked mirrors what U.S. military pilots are reporting today.`,
    chapters: `0:00 The Hook
0:20 Cold War UFO Context
1:30 The Petrozavodsk Incident
3:10 Inside the Setka Program
4:45 The Kapustin Yar Files
6:25 The Byelokoroviche Encounter
8:05 Underwater Anomalies
9:45 The Knapp Investigation
11:25 Congressional Parallels
13:00 The Pattern
13:35 What They Never Explained
14:15 The Aftermath`,
    sources: `Sources & References:
• Setka program — Soviet Ministry of Defense classified directive, 1978
• Petrozavodsk incident, September 20, 1977 — TASS wire reports
• George Knapp investigative reporting — Las Vegas TV and subsequent publications
• Soviet Navy underwater anomaly files — compiled by Paul Stonehill and Philip Mantle
• Kapustin Yar military test range archives`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#sovietufo',
      '#militaryufo',
      '#coldwar',
    ],
  },
  {
    ytId: '0vxsd6buw2w',
    title: 'The USSR Ran the Largest UFO Hunt in History',
    dir: '20260312-135921-vrot',
    aboveFold: `For over a decade, the Soviet military quietly ran the largest state-sponsored UFO investigation in history — and classified every finding. This deep dive reconstructs the Setka program using declassified military documents, tracking everything from the Petrozavodsk event that triggered it to the nuclear base encounters that terrified commanders. The evidence the Soviets collected has never been fully addressed by any government.`,
    chapters: `0:00 The Hook
0:20 Cold War UFO Context
1:30 The Petrozavodsk Incident
3:10 Inside the Setka Program
4:45 The Kapustin Yar Files
6:25 The Byelokoroviche Encounter
8:05 Underwater Anomalies
9:45 The Knapp Investigation
11:25 Congressional Parallels
13:00 The Pattern
13:35 What They Never Explained
14:15 The Aftermath`,
    sources: `Sources & References:
• Setka program — Soviet Ministry of Defense, 1978-1991
• Petrozavodsk incident — TASS wire service and Soviet Academy of Sciences
• George Knapp — investigative journalism on Soviet UFO files
• Soviet Navy USO reports — Stonehill and Mantle research compilations
• Kapustin Yar sightings — Soviet Air Defense command logs`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#sovietufo',
      '#declassified',
      '#militaryufo',
    ],
  },
  {
    ytId: 'IZnGgSIruL0',
    title: 'The Soviet UFO Program That Nearly Started WW3',
    dir: '20260312-150810-j3lc',
    aboveFold: `In October 1982, a UFO hovered over a Soviet nuclear missile base and activated the launch sequence — nearly triggering World War 3. This investigation traces the incident through declassified Soviet military records, connecting it to the larger Setka program that tracked thousands of unexplained encounters across USSR military installations. The nuclear dimension of the Soviet UFO files remains one of the most alarming patterns in the entire phenomenon.`,
    chapters: `0:00 The Launch Sequence
0:20 The Soviet UFO Landscape
1:30 The Petrozavodsk Trigger
3:10 Setka Goes Operational
4:45 Kapustin Yar
6:25 The Byelokoroviche Base
8:05 Undersea Contacts
9:45 Western Investigators
11:25 The Congressional Echo
13:00 The Nuclear Pattern
13:35 Unresolved Evidence
14:15 What Comes Next`,
    sources: `Sources & References:
• Usovo nuclear missile base incident, October 1982 — declassified Soviet military reports
• Setka program directive — Soviet Ministry of Defense, 1978
• Petrozavodsk event, September 1977 — TASS and Soviet Academy of Sciences records
• George Knapp — investigative reporting on Soviet UFO archives
• Soviet Navy submarine fleet USO encounter logs`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#sovietufo',
      '#nuclearufo',
      '#coldwar',
    ],
  },
  {
    ytId: 'OezXWlinvlw',
    title:
      'UAP Disclosure: What the Government Admitted and What They Buried',
    dir: '20260312-183125-oqd0',
    aboveFold: `The U.S. government has officially acknowledged that UAPs are real, that military encounters are ongoing, and that a classified investigation exists — then buried every meaningful detail. This investigation traces the disclosure timeline from AATIP through the 2023 congressional hearings, separating what was actually confirmed from what was quietly suppressed. David Grusch's testimony under oath changed the conversation — but the institutional pushback that followed tells its own story.`,
    chapters: `0:00 The Admission
0:20 Setting the Stage
1:00 AATIP: The Hidden Program
2:15 The UAP Task Force
3:15 AARO and the Pushback
4:30 David Grusch Goes Public
5:45 The Congressional Hearing
7:00 The Schumer Amendment
8:00 Institutional Resistance
9:00 Signal vs. Noise
10:00 Recent Developments
11:00 What They Left Out
11:40 The Road Ahead`,
    sources: `Sources & References:
• AATIP program — confirmed by Pentagon spokesperson, December 2017
• David Grusch testimony — House Oversight Committee hearing, July 26, 2023
• UAP Task Force preliminary assessment — Office of the Director of National Intelligence, June 2021
• Schumer-Rounds UAP Disclosure Amendment — introduced to NDAA, July 2023
• AARO historical review, Volume 1 — released March 2024`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#uapdisclosure',
      '#whistleblower',
      '#pentagon',
    ],
  },
  {
    ytId: '_jKrpgvTcW4',
    title: 'What the Original Anunnaki Tablets Actually Say',
    dir: '20260316-024704-95ah',
    aboveFold: `The Anunnaki story has been retold thousands of times — but almost never from the actual tablets. This investigation goes back to the original Sumerian cuneiform to separate what the ancient scribes actually recorded from what modern authors projected onto them. The Atrahasis epic, the Sumerian King List, and the Eridu Genesis contain claims about human creation, pre-flood rulers, and divine intervention that are strange enough without embellishment.`,
    chapters: `0:00 The Tablet Record
0:20 What We Think We Know
1:25 Ancient Sumer in Context
3:35 The Atrahasis Creation Epic
5:15 The Sumerian King List
7:10 The Flood Narrative
8:55 Sitchin's Interpretations
10:40 What Scholars Actually Found
12:25 The Unanswered Questions
14:50 What the Tablets Leave Open
16:30 The Bigger Picture`,
    sources: `Sources & References:
• Atrahasis epic — Old Babylonian copies, c. 1700 BCE, translated by W.G. Lambert and A.R. Millard
• Sumerian King List — Weld-Blundell Prism, Ashmolean Museum, Oxford
• Eridu Genesis — Nippur tablet, University of Pennsylvania Museum
• Zecharia Sitchin, "The 12th Planet" (1976) — comparative analysis
• Samuel Noah Kramer, "History Begins at Sumer" — standard Assyriological reference
• Electronic Text Corpus of Sumerian Literature (ETCSL) — Oxford University`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#anunnaki',
      '#sumeriantablets',
      '#ancientmystery',
    ],
  },
  {
    ytId: 'RGGDeDLEqYg',
    title:
      "Ancient Metallurgy That Shouldn't Exist Inside 5,000-Year-Old Tombs",
    dir: '20260317-111205-t6l9',
    aboveFold: `Archaeologists have pulled artifacts from 5,000-year-old tombs that contain metallurgical techniques supposedly not invented for another two millennia. This investigation examines four sites — Varna, Gerzeh, Nahal Mishmar, and Tutankhamun's tomb — where the metalwork defies the conventional timeline of technological development. Iron from meteorites, copper-arsenic alloys, and lost-wax casting all appear centuries before they should.`,
    chapters: `0:00 The Impossible Artifacts
0:20 Rethinking the Timeline
1:25 The Varna Necropolis
3:25 The Gerzeh Beads
5:25 The Nahal Mishmar Hoard
7:55 Tutankhamun's Iron Dagger
10:20 The Pattern Across Sites
12:05 What It Means
13:25 The Open Questions`,
    sources: `Sources & References:
• Varna Necropolis excavation — Ivan Ivanov, 1972, Bulgarian Academy of Sciences
• Gerzeh meteoritic iron beads — Petrie Museum, UCL, analyzed by Diane Johnson et al., 2013
• Nahal Mishmar hoard — Pessah Bar-Adon, 1961, Israel Antiquities Authority
• Tutankhamun's iron dagger — Daniela Comelli et al., meteoritics analysis, 2016
• Arsenical copper in early metallurgy — Vincent C. Pigott, "The Archaeometallurgy of the Asian Old World"`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#ancientmystery',
      '#ancienttechnology',
      '#lostcivilization',
    ],
  },
  {
    ytId: 'GTtUz9Yzf5Q',
    title: 'A Cult Built a Machine to Prove Earth Is Hollow. It Worked.',
    dir: '20260318-010032-876a',
    aboveFold: `In 1897, a utopian commune in Florida built a custom surveying device called the Rectilineator to prove that the Earth's surface curves upward — and their measurements confirmed it. This investigation reconstructs the Koreshan Unity experiment, the theology that drove it, the machine they engineered, and the scientific flaws that went undetected for decades. Cyrus Teed's hollow Earth theory attracted thousands of followers and a result that still gets cited today.`,
    chapters: `0:00 The Experiment
0:20 Cyrus Teed's Vision
1:20 Building the Commune
2:20 The Rectilineator
3:25 Running the Experiment
4:25 The Results
5:30 The Scientific Flaws
7:15 The Decline of Koreshan Unity
8:15 The Modern Echo
9:15 What They Actually Proved
10:15 The Lasting Question`,
    sources: `Sources & References:
• Cyrus Teed (Koresh), "The Cellular Cosmogony" (1898)
• Koreshan Unity archives — Koreshan State Historic Site, Estero, Florida
• Ulysses Grant Morrow — Rectilineator experiment documentation, Naples Beach, 1897
• Lyn Millner, "The Allure of Immortality" — historical account of the Koreshan community
• Geodetic survey corrections — atmospheric refraction analysis by Martin Gardner`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#hollowearth',
      '#hiddenhistory',
      '#suppressed',
    ],
  },
  {
    ytId: 'S4t4pW3Xp4M',
    title:
      "UFOs Over the White House: Why the Pentagon's Story Fell Apart",
    dir: '20260319-013706-mf5z',
    aboveFold: `In July 1952, unknown objects appeared on radar and were visually confirmed over Washington, D.C. — directly above the White House and Capitol — on two consecutive weekends. Fighter jets were scrambled. The Pentagon held its largest press conference since World War II. This investigation reconstructs the 1952 Washington UFO flap using radar logs, pilot testimony, and the CIA's classified response that shaped UFO policy for the next fifty years.`,
    chapters: `0:00 Objects Over Washington
0:20 The Cold War Backdrop
1:25 The First Wave: July 19
3:30 The Second Wave: July 26
5:35 The Pentagon Press Conference
7:40 The CIA's Robertson Panel
10:00 What They Buried
11:30 The Lasting Impact`,
    sources: `Sources & References:
• Washington National Airport radar logs, July 19-20 and July 26-27, 1952
• Major General John Samford — Pentagon press conference, July 29, 1952
• Captain Edward Ruppelt, "The Report on Unidentified Flying Objects" (1956)
• CIA Robertson Panel proceedings, January 1953 — declassified via FOIA
• Project Blue Book case files — National Archives
• Dr. James McDonald — atmospheric physicist analysis of temperature inversion theory`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#washingtonufo',
      '#pentagon',
      '#projectbluebook',
    ],
  },
  {
    ytId: 'UWjI139tlVw',
    title:
      "Operation Highjump: Admiral Byrd's Suppressed Antarctic Warning",
    dir: '20260319-231250-mczm',
    aboveFold: `In 1946, the U.S. Navy sent 4,700 men, 13 ships, and 33 aircraft to Antarctica under Admiral Richard Byrd — then pulled the entire operation out months early without explanation. This investigation traces Operation Highjump from its official mission through the anomalies that followed: Byrd's suppressed interview, the abrupt withdrawal, and the classified reports that have never been fully released. What happened at the bottom of the world remains one of the Cold War's most persistent mysteries.`,
    chapters: `0:00 The Expedition
0:20 Why Antarctica
1:00 The Nazi Base Theory
2:25 The Operation Begins
4:30 Byrd's Warning
5:45 The Cover-Up
7:35 What They Left Behind
9:00 The Unanswered Questions`,
    sources: `Sources & References:
• Operation Highjump operational records — U.S. Navy, Task Force 68, 1946-1947
• Admiral Richard E. Byrd — El Mercurio (Santiago, Chile) interview, March 5, 1947
• Neuschwabenland expedition — German Antarctic Expedition, 1938-1939
• U.S. Navy casualty reports — Operation Highjump after-action documentation
• National Archives — declassified Highjump planning documents`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#operationhighjump',
      '#antarctica',
      '#declassified',
    ],
  },
  {
    ytId: 'yYOfqH-Vx7E',
    title: 'The Genetic Blueprint Hidden in Sumerian Clay Tablets',
    dir: '20260320-020616-ylp6',
    aboveFold: `Sumerian clay tablets describe a process of creating humans from divine blood mixed with earthly clay — a narrative that reads differently after the discovery of CRISPR and modern genetic engineering. This investigation examines the parallels between the Atrahasis creation account, the Enuma Elish, and what we now know about DNA manipulation, chromosomal fusion, and the enigmatic two-chromosome merge that separates humans from every other primate. The Sumerian texts may not be science — but they describe something uncomfortably specific.`,
    chapters: `0:00 The Blueprint
0:25 The Modern Discovery
1:30 The Sumerian Account
3:55 The Parallels
5:05 The Enuma Elish
6:10 The ME Tablets
7:10 Physical Tablet Evidence
8:00 Modern Genetic Echoes
9:30 The DNA Serpent
10:40 The Chromosome Problem
12:10 The Skeptical View
13:35 What Cannot Be Dismissed
14:25 The Open Question`,
    sources: `Sources & References:
• Atrahasis epic — Old Babylonian cuneiform, c. 1700 BCE, translated by W.G. Lambert and A.R. Millard
• Enuma Elish — creation narrative, Neo-Assyrian copies from Nineveh
• Human chromosome 2 fusion — J.W. IJdo et al., 1991, Proceedings of the National Academy of Sciences
• Ningishzida and caduceus symbolism — Thorkild Jacobsen, Sumerian iconographic analysis
• CRISPR-Cas9 discovery — Jennifer Doudna and Emmanuelle Charpentier, 2012
• Electronic Text Corpus of Sumerian Literature (ETCSL) — Oxford University`,
    hashtags: [
      '#strangeuniverse',
      '#ufo',
      '#anunnaki',
      '#ancientgenetics',
      '#sumeriantablets',
    ],
  },
];

function buildFullDescription(video: VideoUpdate): string {
  const blocks = [
    video.aboveFold,
    '',
    video.chapters,
    '',
    video.sources,
    '',
    CTA,
    '',
    CREDITS,
    '',
    COPYRIGHT,
  ];
  return blocks.join('\n');
}

async function main(): Promise<void> {
  const { updateVideoMetadata } = await import(
    '../src/services/youtube-service.js'
  );

  console.log(`Starting description updates for ${VIDEOS.length} videos...\n`);

  for (const video of VIDEOS) {
    const description = buildFullDescription(video);

    console.log(`--- Updating: ${video.title} (${video.ytId}) ---`);
    console.log(`Hashtags: ${video.hashtags.join(' ')}`);
    console.log(`Description length: ${description.length} chars`);

    try {
      await updateVideoMetadata(OAUTH_PATH, video.ytId, {
        description,
        hashtags: video.hashtags,
      });
      console.log(`  SUCCESS\n`);
    } catch (err) {
      console.error(`  FAILED: ${err}\n`);
    }

    // Small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('All updates complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
