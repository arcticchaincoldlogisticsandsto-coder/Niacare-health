import { supabase } from './supabaseClient';

export interface Conversation {
  id: string;
  patientId: string;
  staffUserId: string;
  otherPartyName: string;
  otherPartyRole: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface ConversationRow {
  id: string;
  patient_id: string;
  staff_user_id: string;
  last_message_at: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

// Opens (or resolves the existing) conversation with someone the caller has
// a real care relationship with — see start_conversation() in
// supabase/schema.sql, which rejects this otherwise.
export const startConversation = async (
  otherPartyUserId: string
): Promise<{ conversationId?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('start_conversation', { p_other_party_user_id: otherPartyUserId });
  if (error) return { error: error.message };
  return { conversationId: (data as ConversationRow).id };
};

export const fetchConversations = async (
  myUserId: string
): Promise<{ conversations: Conversation[]; error?: string }> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`patient_id.eq.${myUserId},staff_user_id.eq.${myUserId}`)
    .order('last_message_at', { ascending: false });

  if (error) return { conversations: [], error: error.message };
  const rows = (data || []) as ConversationRow[];

  const otherPartyIds = rows.map((r) => (r.patient_id === myUserId ? r.staff_user_id : r.patient_id));
  const profilesById = new Map<string, { full_name: string; role: string }>();
  if (otherPartyIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, full_name, role').in('id', otherPartyIds);
    for (const p of profileRows || []) profilesById.set(p.id, { full_name: p.full_name, role: p.role });
  }

  return {
    conversations: rows.map((row) => {
      const otherId = row.patient_id === myUserId ? row.staff_user_id : row.patient_id;
      const info = profilesById.get(otherId);
      return {
        id: row.id,
        patientId: row.patient_id,
        staffUserId: row.staff_user_id,
        otherPartyName: info?.full_name || 'Care Team',
        otherPartyRole: info?.role || '',
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
      };
    }),
  };
};

export const fetchMessages = async (
  conversationId: string
): Promise<{ messages: ChatMessage[]; error?: string }> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return { messages: [], error: error.message };
  return {
    messages: (data as MessageRow[]).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  };
};

export const sendMessage = async (
  conversationId: string,
  body: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const markMessagesRead = async (conversationId: string, myUserId: string): Promise<void> => {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', myUserId)
    .is('read_at', null);
};
