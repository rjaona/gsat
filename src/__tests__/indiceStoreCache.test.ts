import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getIndiceComplet: vi.fn(async () => ({
    national: [{ code: 'X' }] as unknown[],
    faritany: [] as unknown[],
    dimensionCodes: ['D01'],
    niveauLabel: 'ASN',
  })),
}));
vi.mock('@/services/indiceService', () => ({ getIndiceComplet: h.getIndiceComplet }));

import { useIndiceStore } from '@/stores/indiceStore';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  h.getIndiceComplet.mockClear();
  useIndiceStore.setState({ resultats: [], faritany: [], loadedAt: null, loadedForUser: null, loading: true, error: null });
  useAuthStore.setState({ user: null });
});

describe('indiceStore cache TTL (audit M8)', () => {
  it('ne refetch pas dans la fenêtre TTL (2e load = cache)', async () => {
    await useIndiceStore.getState().load();
    await useIndiceStore.getState().load();
    expect(h.getIndiceComplet).toHaveBeenCalledTimes(1);
    expect(useIndiceStore.getState().resultats).toHaveLength(1);
    expect(useIndiceStore.getState().loading).toBe(false);
  });

  it('force=true contourne le cache', async () => {
    await useIndiceStore.getState().load();
    await useIndiceStore.getState().load(true);
    expect(h.getIndiceComplet).toHaveBeenCalledTimes(2);
  });

  it('refetch si l\'utilisateur change (pas de fuite inter-session)', async () => {
    useAuthStore.setState({ user: { id: 'A' } as never });
    await useIndiceStore.getState().load();
    // user B dans le même onglet → le cache de A ne doit PAS être réutilisé
    useAuthStore.setState({ user: { id: 'B' } as never });
    await useIndiceStore.getState().load();
    expect(h.getIndiceComplet).toHaveBeenCalledTimes(2);
  });
});
