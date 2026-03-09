import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as http from 'http';
import { exec } from 'child_process';
import { config } from './config';

// ── Types ─────────────────────────────────────────────────────

type ChannelFormat = 'long' | 'short' | 'long+short' | 'music-only';

interface ChannelInputs {
  name: string;
  slug: string;
  format: ChannelFormat;
  niche: string;
  elevenLabsVoiceId: string;
  musicOnly: {
    defaultDurationHours: number | null;
    defaultSegmentCount: number | null;
  };
}

interface ChannelConfig {
  channel: {
    name: string;
    slug: string;
    format: ChannelFormat;
    niche: string;
  };
  credentials: {
    youtubeOAuthPath: string;
    elevenLabsVoiceId: string;
  };
  frameworks: {
    script?: string;
    image: string;
    music: string;
    thumbnail: string;
    title: string;
    teaser?: string;
    description: string;
  };
  musicOnly?: {
    defaultDurationHours: number | null;
    defaultSegmentCount: number | null;
  };
}

// ── Constants ─────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(PROJECT_ROOT, 'projects');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'shared', 'channel-templates');
const OAUTH_REDIRECT_PORT = 8765;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_REDIRECT_PORT}/oauth/callback`;
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

// ── Readline helper ───────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));

const askRequired = async (question: string): Promise<string> => {
  let answer = '';
  while (!answer) {
    answer = await ask(question);
    if (!answer) console.log('  ✗ This field is required.');
  }
  return answer;
};

// ── Slug generator ────────────────────────────────────────────

const toSlug = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── Input collection ──────────────────────────────────────────

const collectInputs = async (): Promise<ChannelInputs> => {
  console.log('\n── New Channel Initialization ──\n');

  const name = await askRequired('Channel name: ');
  const slug = `ch-${toSlug(name)}`;
  console.log(`  → Slug: ${slug}`);

  const niche = await askRequired('Niche / topic description: ');

  console.log('\nFormat options: long / short / long+short / music-only');
  let format = '' as ChannelFormat;
  const validFormats: ChannelFormat[] = ['long', 'short', 'long+short', 'music-only'];
  while (!validFormats.includes(format)) {
    const input = await ask('Format: ');
    if (validFormats.includes(input as ChannelFormat)) {
      format = input as ChannelFormat;
    } else {
      console.log(`  ✗ Invalid format. Choose: ${validFormats.join(' / ')}`);
    }
  }

  let elevenLabsVoiceId = '';
  if (format !== 'music-only') {
    elevenLabsVoiceId = await askRequired('ElevenLabs voice ID: ');
  }

  let musicOnly: ChannelInputs['musicOnly'] = { defaultDurationHours: null, defaultSegmentCount: null };
  if (format === 'music-only') {
    const durationInput = await ask('Default video duration in hours (e.g. 8): ');
    const segmentInput = await ask('Default segment count (leave blank for seamless/no segments): ');
    musicOnly = {
      defaultDurationHours: durationInput ? parseFloat(durationInput) : null,
      defaultSegmentCount: segmentInput ? parseInt(segmentInput, 10) : null,
    };
  }

  return { name, slug, format, niche, elevenLabsVoiceId, musicOnly };
};

// ── Template processing ───────────────────────────────────────

const TEMPLATE_MAP: Record<ChannelFormat, string> = {
  'long': 'template-long.md',
  'short': 'template-short.md',
  'long+short': 'template-long-short.md',
  'music-only': 'template-music-only.md',
};

const processTemplate = (inputs: ChannelInputs, oauthPath: string): string => {
  const templateFile = TEMPLATE_MAP[inputs.format];
  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  let content = fs.readFileSync(templatePath, 'utf-8');

  const replacements: Record<string, string> = {
    '{{CHANNEL_NAME}}': inputs.name,
    '{{CHANNEL_SLUG}}': inputs.slug,
    '{{CHANNEL_NICHE}}': inputs.niche,
    '{{ELEVENLABS_VOICE_ID}}': inputs.elevenLabsVoiceId,
    '{{YOUTUBE_OAUTH_PATH}}': oauthPath,
    '{{DEFAULT_DURATION_HOURS}}': String(inputs.musicOnly.defaultDurationHours ?? 'not set'),
    '{{DEFAULT_SEGMENT_COUNT}}': String(inputs.musicOnly.defaultSegmentCount ?? 'none — seamless video'),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value);
  }

  return content;
};

// ── Config generation ─────────────────────────────────────────

const buildConfig = (inputs: ChannelInputs, oauthPath: string): ChannelConfig => {
  const includesShorts = inputs.format === 'short' || inputs.format === 'long+short';
  const includesNarration = inputs.format !== 'music-only';

  const channelConfig: ChannelConfig = {
    channel: {
      name: inputs.name,
      slug: inputs.slug,
      format: inputs.format,
      niche: inputs.niche,
    },
    credentials: {
      youtubeOAuthPath: oauthPath,
      elevenLabsVoiceId: inputs.elevenLabsVoiceId,
    },
    frameworks: {
      ...(includesNarration && { script: 'frameworks/script-formula.md' }),
      image: 'frameworks/image-framework.md',
      music: 'frameworks/music-framework.md',
      thumbnail: 'frameworks/thumbnail-formula.md',
      title: 'frameworks/title-formula.md',
      ...(includesShorts && { teaser: 'frameworks/teaser-formula.md' }),
      description: '../../shared/description-formula.md',
    },
    ...(inputs.format === 'music-only' && { musicOnly: inputs.musicOnly }),
  };

  return channelConfig;
};

// ── Framework scaffolding ─────────────────────────────────────

const FRAMEWORK_FILES: Record<string, string[]> = {
  'long': ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
  'short': ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
  'long+short': ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md', 'teaser-formula.md'],
  'music-only': ['image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
};

const scaffoldFrameworks = (frameworksDir: string, format: ChannelFormat): void => {
  fs.mkdirSync(frameworksDir, { recursive: true });
  for (const file of FRAMEWORK_FILES[format]) {
    const filePath = path.join(frameworksDir, file);
    const name = file.replace('.md', '').replace(/-/g, ' ');
    fs.writeFileSync(filePath, `# ${name}\n\n<!-- Author your framework here before first run -->\n`);
  }
};

// ── YouTube OAuth flow ────────────────────────────────────────

const runYouTubeOAuth = async (channelDir: string, slug: string): Promise<string> => {
  const oauthPath = path.join(channelDir, '.youtube-oauth.json');

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('\n  ⚠  YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not set in .env');
    console.log('     Skipping OAuth — add credentials to .env and re-run oauth separately.\n');
    return oauthPath;
  }

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(YOUTUBE_SCOPES)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log('\n── YouTube OAuth ──');
  console.log(`\n  Opening browser for channel: ${slug}`);
  console.log('  Authorize the account you want this channel to post from.\n');

  // Open browser
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} "${authUrl}"`);

  // Start local server to catch the callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '', `http://localhost:${OAUTH_REDIRECT_PORT}`);
      const authCode = url.searchParams.get('code');
      if (authCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorization complete. You can close this tab.</h2>');
        server.close();
        resolve(authCode);
      } else {
        res.writeHead(400);
        res.end('Missing authorization code.');
        server.close();
        reject(new Error('OAuth callback missing code parameter'));
      }
    });
    server.listen(OAUTH_REDIRECT_PORT);
    server.on('error', reject);
  });

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  fs.writeFileSync(oauthPath, JSON.stringify(tokens, null, 2));
  console.log(`  ✓ OAuth tokens saved to ${oauthPath}`);

  return oauthPath;
};

// ── Main ──────────────────────────────────────────────────────

const initChannel = async (): Promise<void> => {
  try {
    const inputs = await collectInputs();

    const channelDir = path.join(PROJECTS_DIR, inputs.slug);
    const frameworksDir = path.join(channelDir, 'frameworks');

    if (fs.existsSync(channelDir)) {
      const overwrite = await ask(`\n  ⚠  Channel "${inputs.slug}" already exists. Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log('  Cancelled.');
        rl.close();
        return;
      }
    }

    // Create channel directory
    fs.mkdirSync(channelDir, { recursive: true });

    // Run OAuth first so path is available for template and config
    const oauthPath = await runYouTubeOAuth(channelDir, inputs.slug);

    // Generate CLAUDE.md from template
    const claudeMd = processTemplate(inputs, oauthPath);
    fs.writeFileSync(path.join(channelDir, 'CLAUDE.md'), claudeMd);

    // Generate config.json
    const channelConfig = buildConfig(inputs, oauthPath);
    fs.writeFileSync(path.join(channelDir, 'config.json'), JSON.stringify(channelConfig, null, 2));

    // Scaffold empty framework files
    scaffoldFrameworks(frameworksDir, inputs.format);

    console.log(`\n── Channel Initialized ──`);
    console.log(`\n  ✓ ${channelDir}`);
    console.log(`  ✓ CLAUDE.md generated`);
    console.log(`  ✓ config.json generated`);
    console.log(`  ✓ frameworks/ scaffolded (${FRAMEWORK_FILES[inputs.format].length} files)`);
    console.log(`\n  Next: author your framework files in ${frameworksDir}`);
    console.log('  Then open Claude Code in this project and select the channel to begin.\n');

    rl.close();
  } catch (err) {
    console.error('\n  ✗ Init failed:', err);
    rl.close();
    process.exit(1);
  }
};

initChannel();
