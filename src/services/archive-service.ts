import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { AssetFile } from '../types/index.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

const log = createLogger('archive-service');

const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const METADATA_URL = 'https://archive.org/metadata';
const DOWNLOAD_URL = 'https://archive.org/download';

const REQUEST_DELAY_MS = 1500;

interface ArchiveSearchResult {
  identifier: string;
  title: string;
  description?: string;
  date?: string;
  mediatype: string;
}

interface ArchiveFile {
  name: string;
  format: string;
  size: string;
  length?: string;
  width?: string;
  height?: string;
}

export interface StockClip {
  identifier: string;
  title: string;
  fileName: string;
  downloadUrl: string;
  format: string;
  durationSeconds?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  fileSizeBytes?: number | undefined;
  relevanceScore: number;
  matchedQuery: string;
}

/**
 * Search Archive.org for video clips matching a query.
 * Returns ranked results with download URLs.
 */
export async function searchStockFootage(
  query: string,
  maxResults = 10
): Promise<StockClip[]> {
  log.info(`Searching Archive.org: "${query}"`);

  // Filter to public domain / government collections to avoid copyright issues
  // Exclude YouTube reuploads and focus on archival/government sources
  const safeCollections = [
    'USGovernmentDocuments',
    'nasa',
    'military',
    'prelinger',
    'newsandpublicaffairs',
    'tv',
    'FedFlix',
    'usgovernmentfilms',
    'dod',
  ];
  const collectionFilter = safeCollections.map((c) => `collection:${c}`).join(' OR ');

  const params = new URLSearchParams({
    q: `mediatype:movies AND (${query}) AND (${collectionFilter} OR licenseurl:*publicdomain* OR licenseurl:*creativecommons*)`,
    output: 'json',
    rows: String(Math.min(maxResults * 3, 50)),
    page: '1',
    'fl[]': 'identifier,title,description,date,mediatype',
  });

  const response = await fetch(`${SEARCH_URL}?${params}`);
  if (!response.ok) {
    log.warn(`Archive.org search failed: ${response.status}`);
    return [];
  }

  const data = (await response.json()) as {
    response: { docs: ArchiveSearchResult[] };
  };

  const items = data.response.docs;
  if (items.length === 0) {
    log.info('No results found');
    return [];
  }

  log.info(`Found ${items.length} items, fetching metadata...`);

  const clips: StockClip[] = [];

  for (const item of items.slice(0, maxResults)) {
    await delay(REQUEST_DELAY_MS);

    try {
      const itemClips = await getVideoFiles(item);
      clips.push(...itemClips);
    } catch (err) {
      log.debug(`Skipping ${item.identifier}: ${(err as Error).message}`);
    }
  }

  return clips.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Get downloadable video files from an Archive.org item.
 */
async function getVideoFiles(item: ArchiveSearchResult): Promise<StockClip[]> {
  const response = await fetch(`${METADATA_URL}/${item.identifier}/files`);
  if (!response.ok) return [];

  const data = (await response.json()) as { result: ArchiveFile[] };
  const files = data.result ?? [];

  const videoFormats = ['MPEG4', 'h.264', 'MP4', 'Ogg Video', 'WebM'];

  const videoFiles = files.filter(
    (f) =>
      videoFormats.some((fmt) => f.format?.includes(fmt)) ||
      f.name.endsWith('.mp4') ||
      f.name.endsWith('.webm')
  );

  // Prefer MP4, then WebM. Cap file size at 200MB to avoid huge downloads.
  const MAX_FILE_SIZE = 200 * 1024 * 1024;

  const preferred = videoFiles
    .filter((f) => !f.size || parseInt(f.size, 10) <= MAX_FILE_SIZE)
    .sort((a, b) => {
      const aScore = a.name.endsWith('.mp4') ? 2 : a.name.endsWith('.webm') ? 1 : 0;
      const bScore = b.name.endsWith('.mp4') ? 2 : b.name.endsWith('.webm') ? 1 : 0;
      return bScore - aScore;
    });

  // Take the best file per item (avoid downloading every derivative)
  const best = preferred[0];
  if (!best) return [];

  return [
    {
      identifier: item.identifier,
      title: item.title,
      fileName: best.name,
      downloadUrl: `${DOWNLOAD_URL}/${item.identifier}/${encodeURIComponent(best.name)}`,
      format: best.format,
      durationSeconds: best.length ? parseFloat(best.length) : undefined,
      width: best.width ? parseInt(best.width, 10) : undefined,
      height: best.height ? parseInt(best.height, 10) : undefined,
      fileSizeBytes: best.size ? parseInt(best.size, 10) : undefined,
      relevanceScore: 1,
      matchedQuery: item.title,
    },
  ];
}

/**
 * Given a list of image cues from the script, find relevant stock footage
 * for cues that describe real-world footage (military, declassified, historical).
 *
 * Returns a map of section index → StockClip for sections where relevant
 * footage was found. Does NOT force matches — returns empty for sections
 * where no good match exists.
 */
export async function findFootageForCues(
  cues: Array<{ index: number; sectionName: string; narration: string; imageCue: string }>,
  topic: string
): Promise<Map<number, StockClip>> {
  const matches = new Map<number, StockClip>();

  // Build search queries from cues that are likely to have real footage
  const footageKeywords = buildSearchQueries(cues, topic);

  if (footageKeywords.length === 0) {
    log.info('No cues suitable for stock footage');
    return matches;
  }

  // Deduplicate queries and search
  const searched = new Set<string>();
  const allClips: Array<{ query: string; clips: StockClip[] }> = [];

  for (const { query } of footageKeywords) {
    const normalized = query.toLowerCase().trim();
    if (searched.has(normalized)) continue;
    searched.add(normalized);

    const clips = await searchStockFootage(query, 5);
    if (clips.length > 0) {
      allClips.push({ query, clips });
    }
    await delay(REQUEST_DELAY_MS);
  }

  // Match clips to cues based on relevance
  for (const { query, clips } of allClips) {
    const matchingCues = footageKeywords
      .filter((fk) => fk.query === query)
      .map((fk) => fk.cueIndex);

    for (const cueIdx of matchingCues) {
      if (matches.has(cueIdx)) continue;

      const bestClip = clips[0];
      if (bestClip) {
        matches.set(cueIdx, bestClip);
        log.info(
          `Matched section ${cueIdx} → "${bestClip.title}" (${bestClip.identifier})`
        );
      }
    }
  }

  log.info(`Found stock footage for ${matches.size}/${cues.length} sections`);
  return matches;
}

/**
 * Analyze cues and narration to determine which sections could benefit
 * from real archival footage. Only generates queries for sections that
 * describe real events, military footage, or historical content.
 */
function buildSearchQueries(
  cues: Array<{ index: number; sectionName: string; narration: string; imageCue: string }>,
  topic: string
): Array<{ cueIndex: number; query: string }> {
  const queries: Array<{ cueIndex: number; query: string }> = [];

  // Keywords that suggest real footage exists
  const realFootageIndicators = [
    /military/i, /navy/i, /air force/i, /pentagon/i, /congress/i,
    /declassified/i, /footage/i, /film/i, /recording/i, /video/i,
    /radar/i, /flir/i, /infrared/i, /cockpit/i, /pilot/i,
    /nasa/i, /shuttle/i, /apollo/i, /space station/i,
    /nuclear/i, /submarine/i, /aircraft carrier/i,
    /ufo/i, /uap/i, /flying saucer/i, /unidentified/i,
    /government/i, /hearing/i, /testimony/i, /whistleblower/i,
    /nimitz/i, /tic.?tac/i, /gimbal/i, /gofast/i, /aguadilla/i,
    /rendlesham/i, /roswell/i, /phoenix lights/i, /belgian wave/i,
  ];

  for (const cue of cues) {
    const text = `${cue.narration} ${cue.imageCue}`;
    const hasIndicator = realFootageIndicators.some((re) => re.test(text));

    if (!hasIndicator) continue;

    // Extract a focused search query from the narration
    const query = extractSearchQuery(cue.narration, cue.sectionName, topic);
    if (query) {
      queries.push({ cueIndex: cue.index, query });
    }
  }

  return queries;
}

/**
 * Extract a concise search query from narration text.
 * Focuses on the specific event, location, or subject mentioned.
 */
function extractSearchQuery(
  narration: string,
  _sectionName: string,
  topic: string
): string | null {
  // Try to extract specific event names or case references
  const eventPatterns = [
    /nimitz\s+encounter/i,
    /tic.?tac\s+ufo/i,
    /gimbal\s+video/i,
    /gofast/i,
    /aguadilla/i,
    /rendlesham\s+forest/i,
    /phoenix\s+lights/i,
    /belgian\s+wave/i,
    /roswell/i,
    /kumburgaz/i,
    /calvine/i,
    /pentagon\s+ufo/i,
    /aatip/i,
    /project\s+blue\s+book/i,
  ];

  for (const pattern of eventPatterns) {
    const match = narration.match(pattern);
    if (match) return `${match[0]} footage`;
  }

  // Military/government footage queries
  if (/pentagon|congress|hearing/i.test(narration)) {
    return 'pentagon military briefing';
  }
  if (/aircraft carrier|navy ship/i.test(narration)) {
    return 'aircraft carrier navy';
  }
  if (/cockpit|fighter jet|pilot/i.test(narration)) {
    return 'military fighter jet cockpit';
  }
  if (/radar/i.test(narration)) {
    return 'military radar screen';
  }
  if (/nuclear|missile/i.test(narration)) {
    return 'nuclear missile military';
  }
  if (/declassified|classified|document/i.test(narration)) {
    return 'declassified government document';
  }
  if (/ufo|uap|unidentified/i.test(narration)) {
    return `UFO ${topic}`;
  }

  return null;
}

/**
 * Download a stock clip and extract a short segment (10-15s) from it.
 * Uses ffmpeg to stream-download only the needed portion when possible,
 * or downloads full file and trims for smaller files.
 */
export async function downloadClip(
  clip: StockClip,
  outputDir: string,
  segmentDuration = 12
): Promise<AssetFile> {
  await ensureDir(outputDir);
  const safeName = clip.identifier.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const outputPath = join(outputDir, `stock-${safeName}.mp4`);

  log.info(`Downloading segment: ${clip.title} (${clip.identifier})`);

  // Try ffmpeg direct URL extraction first (avoids downloading full file)
  // Start 10% into the video to skip intros/titles
  const startOffset = clip.durationSeconds
    ? Math.floor(clip.durationSeconds * 0.1)
    : 5;

  try {
    await execFileAsync('ffmpeg', [
      '-ss', String(startOffset),
      '-i', clip.downloadUrl,
      '-t', String(segmentDuration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-an',  // strip audio — we use our own music
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { maxBuffer: 50 * 1024 * 1024, timeout: 60000 });

    log.info(`Segment saved: ${outputPath}`);
  } catch {
    // Fallback: download full file then trim
    log.info('Direct extraction failed, downloading full file...');
    const tempPath = join(outputDir, `temp-${safeName}.mp4`);

    const response = await fetch(clip.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(tempPath, buffer);

    await execFileAsync('ffmpeg', [
      '-ss', String(startOffset),
      '-i', tempPath,
      '-t', String(segmentDuration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-an',
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { maxBuffer: 50 * 1024 * 1024 });

    await unlink(tempPath).catch(() => {});
    log.info(`Segment saved (from full download): ${outputPath}`);
  }

  return {
    id: clip.identifier,
    path: outputPath,
    type: 'animation',
    durationSeconds: segmentDuration,
    metadata: {
      source: 'archive.org',
      title: clip.title,
      query: clip.matchedQuery,
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
