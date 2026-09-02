import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, ArrowLeft, Send, User } from 'lucide-react';
import { Language, Theme } from '../types';
import { DoctorProfileTarget } from '../data/doctors';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markMessagesRead,
  Conversation,
  ChatMessage,
} from '../lib/messaging';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  myUserId: string | null;
  language: Language;
  theme: Theme;
  /** Jump straight into this conversation's thread (e.g. a doctor who just started one from PatientDetailModal). */
  initialConversationId?: string | null;
  onViewDoctorProfile?: (target: DoctorProfileTarget) => void;
}

export const MessagesModal: React.FC<MessagesModalProps> = ({ isOpen, onClose, myUserId, language, theme, initialConversationId, onViewDoctorProfile }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!myUserId) { setLoadingConvos(false); return; }
    setLoadingConvos(true);
    const { conversations: fetched, error: err } = await fetchConversations(myUserId);
    if (err) setError(err); else { setConversations(fetched); setError(''); }
    setLoadingConvos(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadConversations();
    setActiveId(initialConversationId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, myUserId, initialConversationId]);

  const loadThread = async (conversationId: string) => {
    setLoadingMessages(true);
    const { messages: fetched, error: err } = await fetchMessages(conversationId);
    if (err) setError(err); else { setMessages(fetched); setError(''); }
    setLoadingMessages(false);
    if (myUserId) markMessagesRead(conversationId, myUserId);
  };

  useEffect(() => {
    if (activeId) loadThread(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const activeConvo = conversations.find((c) => c.id === activeId);

  const handleSend = async () => {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    const { error: err } = await sendMessage(activeId, draft.trim());
    setSending(false);
    if (err) { setError(err); return; }
    setDraft('');
    loadThread(activeId);
    loadConversations();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg h-[75vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeId && (
              <button type="button" onClick={() => setActiveId(null)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <MessageSquare className="w-4.5 h-4.5 flex-shrink-0" />
            <h3 className="text-sm font-bold truncate">
              {activeConvo ? activeConvo.otherPartyName : isSw ? 'Ujumbe' : 'Messages'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {activeConvo && activeConvo.otherPartyRole === 'doctor' && onViewDoctorProfile && (
              <button
                type="button"
                onClick={() => {
                  const otherPartyUserId = activeConvo.patientId === myUserId ? activeConvo.staffUserId : activeConvo.patientId;
                  onViewDoctorProfile({ doctorUserId: otherPartyUserId });
                }}
                aria-label={isSw ? 'Angalia Wasifu wa Daktari' : "View Doctor's Profile"}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                title={isSw ? 'Wasifu wa Daktari' : 'Doctor Profile'}
              >
                <User className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && <p className="px-4 pt-2 text-xs text-rose-600">{error}</p>}

        {!activeId ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loadingConvos && <LoadingSkeleton rows={4} />}
            {!loadingConvos && conversations.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title={isSw ? 'Hakuna Mazungumzo' : 'No Conversations'}
                description={isSw ? 'Ujumbe kutoka kwa timu yako ya afya utaonekana hapa.' : 'Messages from your care team will appear here.'}
              />
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left flex items-center justify-between rounded-xl border p-3 text-xs transition-colors ${
                  isDark ? 'border-slate-800 hover:border-primary' : 'border-slate-100 hover:border-primary'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{c.otherPartyName}</p>
                  <p className="text-slate-500 dark:text-slate-400 capitalize">{c.otherPartyRole.replace('_', ' ')}</p>
                </div>
                <span className="text-slate-400 flex-shrink-0 ml-2">{new Date(c.lastMessageAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingMessages && <LoadingSkeleton rows={3} />}
              {!loadingMessages && messages.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  {isSw ? 'Anza mazungumzo.' : 'Say hello to start the conversation.'}
                </p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === myUserId;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                        mine
                          ? 'bg-primary text-white rounded-br-sm'
                          : isDark
                          ? 'bg-[#0B1522] text-white rounded-bl-sm border border-slate-800'
                          : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
            <div className="p-3 border-t nc-border flex items-center gap-2 flex-shrink-0">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder={isSw ? 'Andika ujumbe...' : 'Type a message…'}
                className="nc-input flex-1 px-3 py-2 text-xs"
              />
              <button
                type="button"
                disabled={sending || !draft.trim()}
                onClick={handleSend}
                className="w-9 h-9 flex-shrink-0 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
