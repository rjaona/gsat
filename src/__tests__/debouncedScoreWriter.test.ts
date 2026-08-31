import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedScoreWriter } from '../utils/debouncedScoreWriter';

describe('createDebouncedScoreWriter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('retarde l appel de 800ms', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writeFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();
    expect(writeFn).toHaveBeenCalledOnce();
    expect(writeFn).toHaveBeenCalledWith('eval1', { critereCode: 'C01', note: 2 }, 'user1');
  });

  it('le dernier clic dans la fenêtre gagne', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 1 }, 'user1');
    vi.advanceTimersByTime(300);
    writer.schedule('eval1', { critereCode: 'C01', note: 3 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writeFn).toHaveBeenCalledOnce();
    expect(writeFn).toHaveBeenCalledWith('eval1', { critereCode: 'C01', note: 3 }, 'user1');
  });

  it('critères différents sont indépendants', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 1 }, 'user1');
    writer.schedule('eval1', { critereCode: 'C02', note: 2 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('flush envoie immédiatement sans attendre le timer', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writeFn).not.toHaveBeenCalled();

    await writer.flush();
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('flush est un no-op si rien en attente', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    await writer.flush();
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('status passe de idle à pending puis saving puis saved', async () => {
    let resolveWrite!: () => void;
    const writeFn = vi.fn().mockImplementation(
      () => new Promise<void>(r => { resolveWrite = r; })
    );
    const writer = createDebouncedScoreWriter(writeFn);

    expect(writer.getStatus()).toBe('idle');

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writer.getStatus()).toBe('pending');

    vi.advanceTimersByTime(800);
    // Le timer a fire, writeFn est appelée (promise en attente)
    await vi.advanceTimersByTimeAsync(0);
    expect(writer.getStatus()).toBe('saving');

    resolveWrite();
    await vi.advanceTimersByTimeAsync(0);
    expect(writer.getStatus()).toBe('saved');
  });

  it('status passe à error si writeScore échoue', async () => {
    const writeFn = vi.fn().mockRejectedValue(new Error('DB down'));
    const onError = vi.fn();
    const writer = createDebouncedScoreWriter(writeFn, onError);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writer.getStatus()).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
