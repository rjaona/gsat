import { supabase } from './supabase';
import type { Notification, NotificationType } from '@/types/notification';

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id:           row['id']            as string,
    type:         row['type']          as NotificationType,
    title:        row['title']         as string,
    message:      row['message']       as string,
    recipientId:  row['recipient_id']  as string,
    senderId:     row['sender_id']     as string | undefined,
    senderName:   row['sender_name']   as string | undefined,
    resourceType: row['resource_type'] as string | undefined,
    resourceId:   row['resource_id']   as string | undefined,
    read:         row['read']          as boolean,
    createdAt:    new Date(row['created_at'] as string),
  };
}

// ── Subscribe (temps réel) ────────────────────────────────────────────────────

export function subscribeNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const fetch = () =>
    supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        callback((data ?? []).map(r => rowToNotification(r as Record<string, unknown>)));
      });

  void fetch();

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications',
      filter: `recipient_id=eq.${userId}`,
    }, () => void fetch())
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ── Mark as read ──────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

// ── Mark all as read ──────────────────────────────────────────────────────────

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) throw error;
}

// ── Get unread count ──────────────────────────────────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

// ── Create notification ───────────────────────────────────────────────────────

export interface CreateNotificationPayload {
  type:         NotificationType;
  title:        string;
  message:      string;
  recipientId:  string;
  senderId?:    string | undefined;
  senderName?:  string | undefined;
  resourceType?: string | undefined;
  resourceId?:  string | undefined;
}

export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<string> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      type:          payload.type,
      title:         payload.title,
      message:       payload.message,
      recipient_id:  payload.recipientId,
      sender_id:     payload.senderId     ?? null,
      sender_name:   payload.senderName   ?? null,
      resource_type: payload.resourceType ?? null,
      resource_id:   payload.resourceId   ?? null,
      read:          false,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ── Delete notification ───────────────────────────────────────────────────────

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);
  if (error) throw error;
}
