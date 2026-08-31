type ScoreInput = { critereCode: string; note: 0 | 1 | 2 | 3 | null | undefined; commentaire?: string };
type WriteFn = (evalId: string, score: ScoreInput, updatedBy: string) => Promise<void>;
type Status = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 800;

export function createDebouncedScoreWriter(
  writeFn: WriteFn,
  onError?: (err: Error) => void,
) {
  // Pending writes keyed by critereCode
  const pending = new Map<string, { evalId: string; score: ScoreInput; updatedBy: string; timer: ReturnType<typeof setTimeout> }>();
  let status: Status = 'idle';
  let statusListeners: Array<(s: Status) => void> = [];

  function setStatus(s: Status) {
    status = s;
    statusListeners.forEach(fn => fn(s));
  }

  async function doWrite(evalId: string, score: ScoreInput, updatedBy: string) {
    setStatus('saving');
    try {
      await writeFn(evalId, score, updatedBy);
      // Only set saved if nothing else is pending
      if (pending.size === 0) setStatus('saved');
    } catch (err) {
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return {
    schedule(evalId: string, score: ScoreInput, updatedBy: string) {
      const key = score.critereCode;
      const existing = pending.get(key);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        pending.delete(key);
        void doWrite(evalId, score, updatedBy);
      }, DEBOUNCE_MS);

      pending.set(key, { evalId, score, updatedBy, timer });
      setStatus('pending');
    },

    async flush(): Promise<void> {
      const entries = Array.from(pending.values());
      pending.forEach(e => clearTimeout(e.timer));
      pending.clear();
      if (entries.length === 0) return;
      await Promise.all(entries.map(e => doWrite(e.evalId, e.score, e.updatedBy)));
    },

    getStatus(): Status { return status; },

    onStatusChange(fn: (s: Status) => void): () => void {
      statusListeners.push(fn);
      return () => { statusListeners = statusListeners.filter(f => f !== fn); };
    },

    destroy() {
      pending.forEach(e => clearTimeout(e.timer));
      pending.clear();
      statusListeners = [];
    },
  };
}
