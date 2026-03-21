import { timingSafeEqual } from 'crypto';

import { Request, Response, NextFunction } from 'express';

export function checkAuthConfig(): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;
  if (!user || !pass) {
    console.error(
      '[auth] FATAL: DASHBOARD_USER or DASHBOARD_PASS is not set. ' +
      'All requests will be denied with 503 until credentials are configured.'
    );
  }
}

function safeEqual(a: string, b: string): boolean {
  // Pad both to the same length so timingSafeEqual doesn't throw on mismatched sizes.
  // This still leaks whether the lengths differ, but passwords short enough to brute-force
  // by length are weak regardless — the important attack we're blocking is timing oracles
  // on the character content itself.
  const maxLen = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(maxLen);
  const bBuf = Buffer.alloc(maxLen);
  aBuf.write(a);
  bBuf.write(b);
  return timingSafeEqual(aBuf, bBuf);
}

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  if (!user || !pass) {
    res.status(503).json({ error: 'Dashboard authentication is not configured. Set DASHBOARD_USER and DASHBOARD_PASS in .env.' });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="YT Dashboard"');
    res.status(401).send('Authentication required');
    return;
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const colonIndex = decoded.indexOf(':');
  const u = colonIndex !== -1 ? decoded.slice(0, colonIndex) : decoded;
  const p = colonIndex !== -1 ? decoded.slice(colonIndex + 1) : '';

  if (safeEqual(u, user) && safeEqual(p, pass)) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="YT Dashboard"');
    res.status(401).send('Invalid credentials');
  }
}
