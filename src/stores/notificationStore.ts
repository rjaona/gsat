import { create } from 'zustand';
import type { Notification } from '@/types/notification';
import {
  subscribeNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from '@/services/notificationService';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  _userId: string | null;
  _subscribedUid: string | null;
  _unsubscribeFn: (() => void) | null;

  // Actions
  subscribe: (userId: string) => () => void;
  unsubscribe: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: true,
  _userId: null,
  _subscribedUid: null,
  _unsubscribeFn: null,

  subscribe: (userId: string) => {
    const { _subscribedUid, _unsubscribeFn } = get();

    if (_subscribedUid === userId) {
      // Listener déjà actif pour cet uid — on retourne le même unsubscribe
      return _unsubscribeFn ?? (() => {});
    }

    // Fermer l'abonnement précédent si l'uid a changé
    if (_unsubscribeFn) {
      _unsubscribeFn();
    }

    set({ loading: true, _userId: userId, _subscribedUid: userId });

    const unsubscribe = subscribeNotifications(
      userId,
      (notifications) => {
        const unreadCount = notifications.filter((n) => !n.read).length;
        set({ notifications, unreadCount, loading: false });
      },
      (err) => {
        console.error('Notification subscription error:', err);
        set({ loading: false });
      },
    );

    set({ _unsubscribeFn: unsubscribe });

    return unsubscribe;
  },

  unsubscribe: () => {
    const { _unsubscribeFn } = get();
    if (_unsubscribeFn) {
      _unsubscribeFn();
    }
    set({
      _subscribedUid: null,
      _unsubscribeFn: null,
      notifications: [],
      unreadCount: 0,
      loading: true,
    });
  },

  markAsRead: async (id: string) => {
    try {
      await markAsReadService(id);
      // Optimistic update — onSnapshot will confirm
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAllAsRead: async () => {
    const userId = get()._userId;
    if (!userId) return;

    try {
      await markAllAsReadService(userId);
      // Optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },
}));
