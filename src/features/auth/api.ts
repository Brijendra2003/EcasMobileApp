// Sign-in, deep-link auth and guarded sign-out (§5.1, §5.2).
import { ApiError } from '../../lib/errors';
import { config } from '../../lib/config';
import { unregisterPush } from '../../lib/push';
import { queryClient } from '../../lib/query-client';
import { clearSecureStore } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { wipeDatabase } from '../../offline/db';
import { hasUnsyncedWork } from '../../offline/repo';
import { useSession } from '../../stores/session';
import { useSyncStatus } from '../../stores/sync';

/**
 * Every persona signs in with email + password (§5.1). Accounts are
 * provisioned by Operations; a parent sees only children whose guardian
 * links Operations verified.
 */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    throw new ApiError(error.status === 400 ? 'BAD_CREDENTIALS' : 'NETWORK', error.status === 400 ? 'Email or password is incorrect.' : error.message);
  }
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${config.scheme}://set-password`,
  });
  if (error) {
    throw new ApiError('RESET_FAILED', error.message);
  }
}

/**
 * Invite and password-reset links (§5.1) arrive as collegeapp://set-password
 * with tokens in the fragment (implicit) or a `code` (PKCE).
 */
export async function sessionFromAuthLink(url: string): Promise<boolean> {
  const [, fragment = ''] = url.split('#');
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(fragment || query);
  const errorDescription = params.get('error_description');
  if (errorDescription) {
    throw new ApiError('LINK_INVALID', errorDescription.replace(/\+/g, ' '));
  }
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) {
      throw new ApiError('LINK_INVALID', 'This link has expired. Ask for a new one.');
    }
    return true;
  }
  const code = new URLSearchParams(query).get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new ApiError('LINK_INVALID', 'This link has expired. Ask for a new one.');
    }
    return true;
  }
  return false;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new ApiError('PASSWORD_FAILED', error.message);
  }
}

export class UnsyncedWorkError extends ApiError {
  constructor() {
    super('UNSYNCED', 'Some registers have not synced yet. Sync them before signing out.');
  }
}

/** Clears every local trace of the user (§5.2 step 3). */
async function wipeLocal() {
  queryClient.clear();
  try {
    await wipeDatabase();
  } catch {
    // Database not opened (e.g. sign-out before bootstrap finished).
  }
  clearSecureStore();
  useSyncStatus.getState().set({ pending: 0, lastSyncAt: null, lastPrefetchAt: null });
}

/**
 * Guarded sign-out (§5.2, rule 7): refused while the outbox holds unsynced
 * registers unless `force` (deactivated account).
 */
export async function signOut(opts: { force?: boolean; reason?: string } = {}) {
  if (!opts.force && (await hasUnsyncedWork().catch(() => false))) {
    throw new UnsyncedWorkError();
  }
  // 1. device token row
  await unregisterPush().catch(() => {});
  // 2. sign out (local scope works offline)
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  // 3. caches, SQLite, MMKV
  await wipeLocal();
  useSession.getState().setSignOutReason(opts.reason ?? null);
  useSession.getState().setSession(null);
}
