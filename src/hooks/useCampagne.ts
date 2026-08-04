import { useEffect, useCallback } from 'react';
import { useCampagneStore } from '@/stores/campagneStore';
import { useAuthStore } from '@/stores/authStore';
import type { Campagne, CampagneStatut } from '@/types';
import type { CampagnePayload } from '@/services/campagneService';

// ── Hook liste des campagnes ──────────────────────────────────────────────────

export function useCampagnes(filtreStatut?: CampagneStatut) {
  const { campagnes, loading, error, subscribe } = useCampagneStore();

  useEffect(() => {
    const unsubscribe = subscribe(filtreStatut);
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreStatut]);

  return { campagnes, loading, error };
}

// ── Hook campagne sélectionnée ────────────────────────────────────────────────

export function useCampagneDetail(id: string | undefined) {
  const { selected, loading, error, select, clearSelected } = useCampagneStore();

  useEffect(() => {
    if (!id) {
      clearSelected();
      return;
    }
    select(id);
    return () => clearSelected();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { campagne: selected, loading, error };
}

// ── Hook actions CRUD (admin_global uniquement pour create/delete) ────────────

export function useCampagneActions() {
  const { create, update, updateStatut, remove, loading, error } = useCampagneStore();
  const { user, role } = useAuthStore();

  const canManage = role === 'admin_global' || role === 'responsable_region';

  const creerCampagne = useCallback(
    async (payload: Omit<CampagnePayload, 'organisateurId' | 'createdBy'>): Promise<string> => {
      if (!user) throw new Error('Non authentifié');
      return create({ ...payload, organisateurId: user.id, createdBy: user.id }, user.id);
    },
    [create, user]
  );

  const modifierCampagne = useCallback(
    (id: string, data: Partial<Omit<Campagne, 'id' | 'createdAt' | 'createdBy'>>) =>
      update(id, data),
    [update]
  );

  const changerStatut = useCallback(
    (id: string, statut: CampagneStatut) => updateStatut(id, statut),
    [updateStatut]
  );

  const supprimerCampagne = useCallback(
    (id: string) => remove(id),
    [remove]
  );

  return {
    creerCampagne,
    modifierCampagne,
    changerStatut,
    supprimerCampagne,
    canManage,
    loading,
    error,
  };
}

// ── Hook campagnes ouvertes ───────────────────────────────────────────────────

export function useCampagnesOuvertes() {
  const { getCampagnesOuvertes, loading, error, subscribe } = useCampagneStore();

  useEffect(() => {
    const unsubscribe = subscribe('ouverte');
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { campagnes: getCampagnesOuvertes(), loading, error };
}
