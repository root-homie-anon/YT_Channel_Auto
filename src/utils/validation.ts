/**
 * Input validation utilities for route parameters.
 * Used to prevent path traversal attacks via slug and productionId params.
 */

/** Channel slugs must be of the form ch-[lowercase-alphanumeric-and-hyphens] */
const SLUG_RE = /^ch-[a-z0-9-]+$/;

/** Production IDs must be of the form YYYYMMDD-HHMMSS-[4 hex chars] */
const PRODUCTION_ID_RE = /^\d{8}-\d{6}-[a-z0-9]{4}$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function isValidProductionId(s: string): boolean {
  return PRODUCTION_ID_RE.test(s);
}
