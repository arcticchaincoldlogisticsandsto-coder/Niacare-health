import React, { useState } from 'react';
import { KeyRound, Mail, Phone, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { Language, OtpDeliveryChannel, Theme } from '../types';

interface QuickLoginProps {
  language: Language;
  theme: Theme;
  onSendOtp: (channel: OtpDeliveryChannel, target: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: () => void;
}

export const QuickLogin: React.FC<QuickLoginProps> = ({ language, theme, onSendOtp, onRegister }) => {
  const [channel, setChannel] = useState<OtpDeliveryChannel>('email');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const isDark = theme === 'dark';

  const send = async () => {
    const value = target.trim();
    if (!value || (channel === 'email' ? !value.includes('@') : !/^\+\d{8,15}$/.test(value))) {
      setError(channel === 'email' ? 'Enter the email address linked to your account.' : 'Enter your phone in international format, e.g. +255754829140.');
      return;
    }
    setSending(true);
    setError('');
    const result = await onSendOtp(channel, value);
    setSending(false);
    if (!result.success) setError(result.error || 'We could not send a verification code.');
  };

  return (
    <section className={`mt-3 rounded-2xl border p-5 sm:p-7 ${isDark ? 'bg-[#101F31] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
      <div className="mx-auto max-w-md text-center">
        <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-blue-50 text-[#0A4275]'}`}><KeyRound className="w-5 h-5" /></div>
        <h2 className="text-xl font-black">{language === 'sw' ? 'Ingia kwenye akaunti yako' : 'Sign in to NiaCare'}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Patient, doctor, provider staff, and administrator accounts use the same secure verification.</p>
      </div>
      <div className="mx-auto mt-6 max-w-md space-y-3">
        <div className={`grid grid-cols-2 gap-1 rounded-xl border p-1 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          {(['email', 'phone'] as OtpDeliveryChannel[]).map((item) => <button key={item} type="button" onClick={() => { setChannel(item); setError(''); }} className={`rounded-lg py-2 text-xs font-bold ${channel === item ? (isDark ? 'bg-cyan-500 text-slate-950' : 'bg-[#0A4275] text-white') : 'text-slate-500'}`}>{item === 'email' ? <span className="flex items-center justify-center gap-1"><Mail className="w-3.5 h-3.5" />Email</span> : <span className="flex items-center justify-center gap-1"><Phone className="w-3.5 h-3.5" />SMS</span>}</button>)}
        </div>
        <input type={channel === 'email' ? 'email' : 'tel'} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={channel === 'email' ? 'name@example.com' : '+255754829140'} className={`w-full rounded-xl border px-3.5 py-3 text-sm outline-none ${isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`} />
        {error && <p className="flex gap-1.5 text-xs font-semibold text-red-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
        <button type="button" onClick={send} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A4275] py-3 font-bold text-white hover:bg-[#08365f] disabled:opacity-60">{sending ? 'Sending…' : 'Send verification code'}<ArrowRight className="w-4 h-4" /></button>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />Your account role is applied after verification.</p>
        <button type="button" onClick={onRegister} className="w-full text-xs font-bold text-[#0A4275] dark:text-cyan-300">New to NiaCare? Create a patient account</button>
      </div>
    </section>
  );
};
