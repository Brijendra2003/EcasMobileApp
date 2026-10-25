// Maps RPC / network failures to user-facing messages (§7.1). Server codes and
// their messages come from the synced src/shared/errors.ts; the few codes that
// only the mobile API raises are added here.
import { ERROR_MESSAGES } from '../shared/errors';

const MOBILE_MESSAGES: Record<string, string> = {
  LEAVE_OVERLAP: 'You already have leave for part of this time.',
  ATT_NEEDS_REOPEN: 'This register was locked without a submission. Ask your HOD to reopen it.',
  NETWORK: "You're offline. Try again when you're connected.",
  DUPLICATE: 'You have already raised this. Wait for a reply.',
};

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function messageForCode(code: string): string {
  return MOBILE_MESSAGES[code] ?? (ERROR_MESSAGES as Record<string, string>)[code] ?? 'Something went wrong. Try again.';
}

/** True for failures where retrying later can succeed (no response, 5xx, timeouts). */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof ApiError) {
    return e.code === 'NETWORK';
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /network request failed|failed to fetch|timeout|aborted|fetch failed/i.test(msg);
}

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Converts a PostgREST error into an ApiError carrying the stable code. */
export function toApiError(error: PostgrestLikeError | Error | null | undefined, status?: number): ApiError {
  if (!error) {
    return new ApiError('UNKNOWN', messageForCode('UNKNOWN'));
  }
  const message = 'message' in error && error.message ? error.message : '';
  // RPCs raise `raise exception 'CODE'` (SQLSTATE P0001); PostgREST returns the code as the message.
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) {
    return new ApiError(message, messageForCode(message));
  }
  if (isNetworkError(error) || (status !== undefined && (status === 0 || status >= 500))) {
    return new ApiError('NETWORK', messageForCode('NETWORK'));
  }
  if (status === 401 || /JWT/i.test(message)) {
    return new ApiError('AUTH_REQUIRED', messageForCode('AUTH_REQUIRED'));
  }
  return new ApiError('UNKNOWN', message || messageForCode('UNKNOWN'));
}

/** Unwraps a supabase-js response, throwing ApiError on failure. */
export function unwrap<T>(res: { data: T | null; error: PostgrestLikeError | null; status?: number }): T {
  if (res.error) {
    throw toApiError(res.error, res.status);
  }
  return res.data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    return e.message;
  }
  if (isNetworkError(e)) {
    return messageForCode('NETWORK');
  }
  return e instanceof Error && e.message ? e.message : messageForCode('UNKNOWN');
}
