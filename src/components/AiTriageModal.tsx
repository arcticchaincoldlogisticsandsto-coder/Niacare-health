import React, { useState } from 'react';
import { X, Sparkles, Send, AlertCircle } from 'lucide-react';
import { Language, Theme } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AiTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  language: Language;
}

interface ChatEntry {
  sender: 'user' | 'ai';
  text: string;
}

const getInitialGreeting = (language: Language): string => {
  if (language === 'sw') {
    return 'Habari! Mimi ni NiaAI, Mshauri wako wa Afya. Una dalili gani leo (mf. homa, maumivu ya kichwa, uchovu)?';
  }
  if (language === 'fr') {
    return 'Bonjour ! Je suis NiaAI, votre assistant santé. Quels symptômes ressentez-vous aujourd’hui ?';
  }
  return 'Hello! I am NiaAI, your smart health triage assistant. What symptoms are you experiencing today?';
};

const getErrorReply = (language: Language): string => {
  if (language === 'sw') {
    return 'Samahani, sikuweza kuunganisha na mfumo wa AI kwa sasa. Tafadhali jaribu tena baadaye, au weka miadi na daktari moja kwa moja.';
  }
  if (language === 'fr') {
    return "Désolé, je n'ai pas pu me connecter au service IA pour le moment. Réessayez plus tard, ou prenez directement rendez-vous avec un médecin.";
  }
  return "Sorry, I couldn't reach the AI service right now. Please try again shortly, or book a doctor consultation directly.";
};

export const AiTriageModal: React.FC<AiTriageModalProps> = ({ isOpen, onClose, theme, language }) => {
  const isDark = theme === 'dark';

  const [aiMessage, setAiMessage] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<ChatEntry[]>([
    { sender: 'ai', text: getInitialGreeting(language) },
  ]);
  const [isSending, setIsSending] = useState(false);

  const handleSendAiMessage = async () => {
    if (!aiMessage.trim() || isSending) return;
    const userMsg = aiMessage;
    setAiMessage('');
    const nextHistory: ChatEntry[] = [...aiChatHistory, { sender: 'user', text: userMsg }];
    setAiChatHistory(nextHistory);
    setIsSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional — when present, the server grounds its reply in this
          // patient's real medical records/prescriptions. Triage still
          // works without it, just without personalization.
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          language,
          messages: nextHistory.map((entry) => ({
            role: entry.sender === 'user' ? 'user' : 'assistant',
            content: entry.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      const data = await response.json();
      const reply: string = data.reply || getErrorReply(language);
      setAiChatHistory((prev) => [...prev, { sender: 'ai', text: reply }]);
    } catch {
      setAiChatHistory((prev) => [...prev, { sender: 'ai', text: getErrorReply(language) }]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div
        className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border relative flex flex-col h-[520px] ${
          isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black">NiaAI Smart Triage Assistant</h3>
            <span className="text-[10px] text-emerald-500 font-semibold block leading-none">
              ● Mfumo wa AI wa Ushauri wa Afya Mtandaoni
            </span>
          </div>
        </div>

        {/* Clinical decision support disclaimer */}
        <div
          className={`mb-2.5 flex-shrink-0 p-2 rounded-xl text-[10px] flex items-start gap-1.5 ${
            isDark ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>
            {language === 'sw'
              ? 'Huu ni ushauri wa kimsingi tu, si utambuzi wa daktari. Piga 112/999 kwa dharura.'
              : 'Non-diagnostic guidance only, not a medical diagnosis. Call 112/999 for emergencies.'}
          </span>
        </div>

        {/* Chat message bubbles */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
          {aiChatHistory.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'ml-auto bg-[#0A4275] text-white rounded-br-xs'
                  : isDark
                  ? 'bg-slate-800/90 text-slate-200 rounded-bl-xs border border-slate-700/60'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {isSending && (
            <div
              className={`p-3 rounded-2xl max-w-[50%] rounded-bl-xs ${
                isDark ? 'bg-slate-800/90 border border-slate-700/60' : 'bg-slate-100'
              }`}
            >
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              </span>
            </div>
          )}
        </div>

        {/* Quick symptom suggestions */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 flex-shrink-0 text-[10px]">
          <button
            type="button"
            onClick={() => setAiMessage('Nina maumivu ya kichwa na homa kidogo')}
            className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 whitespace-nowrap cursor-pointer hover:border-cyan-400"
          >
            🤒 Homa & Kichwa
          </button>
          <button
            type="button"
            onClick={() => setAiMessage('Nahitaji ushauri wa kipimo cha Malaria')}
            className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 whitespace-nowrap cursor-pointer hover:border-cyan-400"
          >
            🧪 Kipimo cha Malaria
          </button>
        </div>

        {/* Chat input form */}
        <div className="pt-2 flex items-center gap-2 flex-shrink-0 border-t border-slate-200 dark:border-slate-800">
          <input
            type="text"
            placeholder="Eleza dalili zako hapa..."
            value={aiMessage}
            onChange={(e) => setAiMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
            disabled={isSending}
            className={`flex-1 text-xs p-3 rounded-xl border outline-none disabled:opacity-60 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
            }`}
          />
          <button
            type="button"
            onClick={handleSendAiMessage}
            disabled={isSending}
            className="p-3 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer hover:bg-cyan-400 transition-all flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
