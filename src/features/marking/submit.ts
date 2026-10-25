// Submit (§8.2 → §9.3): freeze the draft, create the client_submission_id,
// enqueue in the outbox, then sync now if online. Works with no network.
import { getDeviceId, uuidv4 } from '../../lib/ids';
import { freezeAndEnqueue, getRegister } from '../../offline/repo';
import { syncNow } from '../../offline/service';
import { useSyncStatus } from '../../stores/sync';
import { submitRecords, type Marks, type RosterEntry } from './logic';
import { flushAutosave } from './store';

export async function submitRegister(opts: {
  sessionId: string;
  roster: RosterEntry[];
  marks: Marks;
  settable: Set<string>;
  baseVersion?: number;
}) {
  await flushAutosave();
  const register = await getRegister(opts.sessionId);
  const now = new Date().toISOString();
  await freezeAndEnqueue({
    session_id: opts.sessionId,
    client_submission_id: uuidv4(),
    base_version: opts.baseVersion ?? register?.base_version ?? 0,
    records: submitRecords(opts.roster, opts.marks, opts.settable, now),
    client_marked_at: now,
    device_id: await getDeviceId(),
  });
  useSyncStatus.getState().bump();
  if (useSyncStatus.getState().online) {
    return syncNow();
  }
  return null;
}
