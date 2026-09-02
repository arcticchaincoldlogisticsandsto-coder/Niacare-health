import { supabase } from './supabaseClient';

export type NotificationCategory = 'appointments' | 'reminders' | 'results' | 'follow_up' | 'payments' | 'messages' | 'access' | 'general';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

const mapRow = (row: NotificationRow): AppNotification => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  linkedEntityType: row.linked_entity_type,
  linkedEntityId: row.linked_entity_id,
  readAt: row.read_at,
  createdAt: row.created_at,
});

export const fetchNotifications = async (
  userId: string,
  limit: number = 30
): Promise<{ notifications: AppNotification[]; unreadCount: number; error?: string }> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { notifications: [], unreadCount: 0, error: error.message };
  const rows = (data || []) as NotificationRow[];
  return {
    notifications: rows.map(mapRow),
    unreadCount: rows.filter((r) => !r.read_at).length,
  };
};

// Notifications are low-stakes enough that the owner may update read_at
// directly (see the RLS policy comment in supabase/schema.sql) — no RPC.
export const markNotificationRead = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const markAllNotificationsRead = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
