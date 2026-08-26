import { supabase } from './supabaseClient';

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  patient_id: string | null;
  patientName?: string;
}

export interface InventoryRow {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  unit: string;
}

export interface FacilityMessageRow {
  id: string;
  body: string;
  created_at: string;
  senderName: string;
}

const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  for (const row of data || []) map.set(row.id, row.full_name);
  return map;
};

export const fetchTasks = async (providerId: string): Promise<{ tasks: TaskRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, due_at, patient_id')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) return { tasks: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.patient_id).filter(Boolean) as string[]);
  return { tasks: rows.map((r) => ({ ...r, patientName: r.patient_id ? names.get(r.patient_id) : undefined })) };
};

export const createTask = async (providerId: string, title: string, dueAt: string | null): Promise<{ error?: string }> => {
  const { error } = await supabase.from('tasks').insert({
    provider_id: providerId,
    title,
    due_at: dueAt,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });
  return { error: error?.message };
};

export const updateTaskStatus = async (id: string, status: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
  return { error: error?.message };
};

export const fetchInventory = async (providerId: string): Promise<{ items: InventoryRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, quantity, minimum_quantity, unit')
    .eq('provider_id', providerId)
    .order('name');
  if (error) return { items: [], error: error.message };
  return { items: (data || []) as InventoryRow[] };
};

export const updateInventoryQuantity = async (id: string, quantity: number): Promise<{ error?: string }> => {
  const { error } = await supabase.from('inventory_items').update({ quantity }).eq('id', id);
  return { error: error?.message };
};

export const addInventoryItem = async (providerId: string, name: string, quantity: number, minimumQuantity: number, unit: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('inventory_items').insert({ provider_id: providerId, name, quantity, minimum_quantity: minimumQuantity, unit });
  return { error: error?.message };
};

export const fetchFacilityMessages = async (providerId: string): Promise<{ messages: FacilityMessageRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('facility_messages')
    .select('id, body, created_at, sender_id')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { messages: [], error: error.message };
  const rows = data || [];
  const names = await namesFor(rows.map((r) => r.sender_id).filter(Boolean) as string[]);
  return { messages: rows.map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, senderName: r.sender_id ? names.get(r.sender_id) || 'Staff' : 'Staff' })) };
};

export const postFacilityMessage = async (providerId: string, body: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('facility_messages').insert({
    provider_id: providerId,
    body,
    sender_id: (await supabase.auth.getUser()).data.user?.id,
  });
  return { error: error?.message };
};
