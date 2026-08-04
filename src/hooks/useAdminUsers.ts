import { useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@/types';
import { listUsers } from '@/services/adminService';
import { useAuthStore } from '@/stores/authStore';

interface UseAdminUsersResult {
  users: UserProfile[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAdminUsers(): UseAdminUsersResult {
  const role = useAuthStore(s => s.role);
  const orgId = useAuthStore(s => s.orgId);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listUsers(role, orgId)
      .then(setUsers)
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [tick, role, orgId]);

  const reload = useCallback(() => setTick(t => t + 1), []);

  return { users, loading, error, reload };
}
