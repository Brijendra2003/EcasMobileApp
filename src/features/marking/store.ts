// Marking session state (§16: < 50 ms tap-to-feedback). Each roster row
// subscribes to its own student's mark, so a tap re-renders one row. Every
// change is autosaved to the SQLite draft in order.
import { create } from 'zustand';
import { setMark, setMarksBulk } from '../../offline/repo';
import { useSyncStatus } from '../../stores/sync';
import { bulkMarks, displayStatus, toggled, type Marks, type RosterEntry } from './logic';

interface MarkingState {
  sessionId: string | null;
  roster: RosterEntry[];
  marks: Marks;
  readOnly: boolean;
  load: (sessionId: string, roster: RosterEntry[], marks: Marks, readOnly: boolean) => void;
  setStatus: (studentId: string, status: string | null) => void;
  toggle: (studentId: string) => void;
  bulk: (status: string) => void;
  clear: () => void;
}

let saveChain: Promise<unknown> = Promise.resolve();
function persist(fn: () => Promise<unknown>) {
  saveChain = saveChain.then(fn).catch(() => {});
}

/** Resolves once every queued autosave has reached SQLite (called before Submit). */
export function flushAutosave(): Promise<unknown> {
  return saveChain;
}

export const useMarking = create<MarkingState>((set, get) => ({
  sessionId: null,
  roster: [],
  marks: {},
  readOnly: false,
  load: (sessionId, roster, marks, readOnly) => set({ sessionId, roster, marks, readOnly }),
  setStatus: (studentId, status) => {
    const { sessionId, readOnly } = get();
    if (!sessionId || readOnly) {
      return;
    }
    set(s => ({ marks: { ...s.marks, [studentId]: status } }));
    persist(() => setMark(sessionId, studentId, status));
  },
  toggle: studentId => {
    const { roster, marks } = get();
    const entry = roster.find(r => r.student_id === studentId);
    get().setStatus(studentId, toggled(displayStatus(marks[studentId], entry?.suggested_status)));
  },
  bulk: status => {
    const { sessionId, roster, marks, readOnly } = get();
    if (!sessionId || readOnly) {
      return;
    }
    const changes = bulkMarks(roster, marks, status);
    set({ marks: { ...marks, ...changes } });
    persist(() => setMarksBulk(sessionId, changes));
  },
  clear: () => {
    persist(async () => useSyncStatus.getState().bump());
    set({ sessionId: null, roster: [], marks: {}, readOnly: false });
  },
}));

/** Display status of one student (row-level subscription). */
export function useStudentStatus(studentId: string, suggested: string | null): string | null {
  return useMarking(s => displayStatus(s.marks[studentId], suggested));
}
