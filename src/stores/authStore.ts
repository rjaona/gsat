import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types';
import { onAuthChanged, getUserProfile, getTokenClaims } from '@/services/authService';
import { useNotificationStore } from './notificationStore';

interface AuthState {
  user:    User    | null;
  session: Session | null;
  profile: UserProfile | null;
  role:    UserRole | undefined;
  orgId:   string  | undefined;
  orgType: string  | undefined;
  loading: boolean;
  initialized: boolean;

  // Actions
  init:  () => () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:        null,
  session:     null,
  profile:     null,
  role:        undefined,
  orgId:       undefined,
  orgType:     undefined,
  loading:     true,
  initialized: false,

  init: () => {
    let unsubscribeNotifications: (() => void) | null = null;

    const unsubscribeAuth = onAuthChanged(async (user, session) => {
      // Nettoyer les abonnements de l'utilisateur précédent
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
      }

      if (!user || !session) {
        set({
          user: null, session: null, profile: null,
          role: undefined, orgId: undefined, orgType: undefined,
          loading: false, initialized: true,
        });
        return;
      }

      try {
        // Lire les claims JWT et le profil en parallèle
        const claims = getTokenClaims(session);
        const profile = await getUserProfile(user.id);

        set({
          user,
          session,
          profile,
          role:    (claims.role    ?? profile?.role)    as UserRole | undefined,
          orgId:   claims.orgId   ?? profile?.orgId,
          orgType: claims.orgType ?? profile?.orgType,
          loading: false,
          initialized: true,
        });

        // S'abonner aux notifications en temps réel
        unsubscribeNotifications = useNotificationStore.getState().subscribe(user.id);
      } catch {
        set({ user, session, profile: null, loading: false, initialized: true });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
      }
    };
  },

  reset: () => set({
    user:    null,
    session: null,
    profile: null,
    role:    undefined,
    orgId:   undefined,
    orgType: undefined,
    loading: false,
  }),
}));
