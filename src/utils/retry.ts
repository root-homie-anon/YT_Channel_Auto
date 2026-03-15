import { createLogger } from './logger.js';

const log = createLogger('retry');

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  retryOn: isTransientError,
};

/**
 * Detect transient errors worth retrying: network failures, 5xx, 429, timeouts.
 */
function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();

  // Network errors
  if (msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  if (msg.includes('etimedout') || msg.includes('timed out') || msg.includes('timeout')) return true;
  if (msg.includes('socket hang up') || msg.includes('network')) return true;

  // Server errors (5xx)
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
  if (msg.includes('internal server error') || msg.includes('bad gateway') || msg.includes('service unavailable')) return true;

  // Rate limiting
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) return true;

  return false;
}

/**
 * Execute a function with exponential backoff retry on transient errors.
 *
 * Non-transient errors (4xx auth, validation, credits) are thrown immediately.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as Error;

      if (attempt >= opts.maxAttempts || !opts.retryOn(err)) {
        throw err;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        opts.maxDelayMs,
      );

      log.warn(`${label}: attempt ${attempt}/${opts.maxAttempts} failed (${err.message}), retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(`${label}: exhausted all ${opts.maxAttempts} attempts`);
}
