import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// ── Mock Supabase client ──────────────────────────────────────────────────────
// Les tests unitaires ne doivent pas se connecter à Supabase.
// Ce mock couvre tous les services qui importent '@/services/supabase'.

vi.mock('@/services/supabase', () => {
  const mockSelect    = vi.fn().mockReturnThis();
  const mockEq        = vi.fn().mockReturnThis();
  const mockNeq       = vi.fn().mockReturnThis();
  const mockIn        = vi.fn().mockReturnThis();
  const mockOrder     = vi.fn().mockReturnThis();
  const mockLimit     = vi.fn().mockReturnThis();
  const mockInsert    = vi.fn().mockReturnThis();
  const mockUpdate    = vi.fn().mockReturnThis();
  const mockUpsert    = vi.fn().mockReturnThis();
  const mockDelete    = vi.fn().mockReturnThis();
  const mockSingle    = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockThen      = vi.fn().mockResolvedValue({ data: [], error: null });

  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    neq: mockNeq,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
  }));

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: mockFrom,
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
          deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: null, error: null }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://mock.url' }, error: null }),
        })),
      },
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    },
  };
});
