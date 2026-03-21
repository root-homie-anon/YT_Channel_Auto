import { Router, Request, Response } from 'express';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonFile, readJsonFile } from '../../utils/file-helpers.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('routes/oauth');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

const OAUTH_PORT = 8765;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/oauth/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

const router = Router();

// Pending OAuth states: nonce -> { slug, resolve }
const pendingFlows = new Map<string, { slug: string; resolve: (code: string) => void }>();
let callbackServer: ReturnType<typeof createServer> | null = null;

const CALLBACK_SERVER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function closeCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close(() => {
      console.log('OAuth callback server closed');
    });
    callbackServer = null;
    // Reject any still-pending flows (server closed before callback)
    for (const [nonce] of pendingFlows) {
      pendingFlows.delete(nonce);
    }
  }
}

function ensureCallbackServer(): void {
  if (callbackServer) return;

  callbackServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '', `http://localhost:${OAUTH_PORT}`);

    if (url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (code && state && pendingFlows.has(state)) {
        const entry = pendingFlows.get(state)!;
        pendingFlows.delete(state);
        entry.resolve(code);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="background:#0f1117;color:#e4e6f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
            <div style="text-align:center">
              <h2>Authorization Complete</h2>
              <p>You can close this tab. Return to the dashboard.</p>
            </div>
          </body></html>
        `);

        // Close server once callback received — no longer needed
        setImmediate(closeCallbackServer);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid or expired OAuth callback');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  callbackServer.listen(OAUTH_PORT, () => {
    console.log(`OAuth callback server listening on port ${OAUTH_PORT}`);
  });

  callbackServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`OAuth callback port ${OAUTH_PORT} already in use`);
    } else {
      console.error('OAuth callback server error:', err);
    }
  });

  // Auto-close after 5 minutes if no callback received
  setTimeout(closeCallbackServer, CALLBACK_SERVER_TIMEOUT_MS);
}

// Start OAuth flow — returns the auth URL
router.post('/:slug/oauth/start', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const channelDir = join(PROJECT_ROOT, 'projects', slug);

    if (!existsSync(channelDir)) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Per-channel OAuth: read from channel's .youtube-oauth.json first, fall back to .env
    let clientId = process.env.YOUTUBE_CLIENT_ID;
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    const oauthPath = join(channelDir, '.youtube-oauth.json');
    if (existsSync(oauthPath)) {
      const oauthData = await readJsonFile<{ web?: { client_id?: string; client_secret?: string } }>(oauthPath);
      if (oauthData.web?.client_id) clientId = oauthData.web.client_id;
      if (oauthData.web?.client_secret) clientSecret = oauthData.web.client_secret;
    }

    if (!clientId || !clientSecret) {
      res.status(400).json({ error: 'No OAuth credentials found in channel .youtube-oauth.json or .env' });
      return;
    }

    ensureCallbackServer();

    const nonce = randomUUID();
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(nonce)}`;

    // Set up a promise that resolves when the callback is hit
    const codePromise = new Promise<string>((resolveCode) => {
      pendingFlows.set(nonce, { slug, resolve: resolveCode });
    });

    // Don't block — return the URL immediately
    res.json({ authUrl, status: 'waiting_for_callback' });

    // Wait for callback in background, then exchange for tokens
    const code = await codePromise;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      console.error('OAuth token exchange failed:', tokens);
      return;
    }

    // Save tokens alongside the client credentials
    let existing: Record<string, unknown> = {};
    if (existsSync(oauthPath)) {
      existing = await readJsonFile<Record<string, unknown>>(oauthPath);
    }

    await writeJsonFile(oauthPath, {
      ...existing,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expiry_date: Date.now() + (tokens.expires_in ?? 3600) * 1000,
        scope: tokens.scope,
      },
    });

    log.info(`OAuth tokens saved for ${slug}`);
  } catch (err) {
    log.error(`OAuth flow error: ${(err as Error).message}`);
  }
});

// Check OAuth status for a channel
router.get('/:slug/oauth/status', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const oauthPath = join(PROJECT_ROOT, 'projects', slug, '.youtube-oauth.json');

    if (!existsSync(oauthPath)) {
      res.json({ hasCredentials: false, hasTokens: false });
      return;
    }

    const data = await readJsonFile<Record<string, unknown>>(oauthPath);
    const hasTokens = !!(data as { tokens?: { access_token?: string } }).tokens?.access_token;

    res.json({ hasCredentials: true, hasTokens });
  } catch (err) {
    log.error(`OAuth status check failed: ${(err as Error).message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
