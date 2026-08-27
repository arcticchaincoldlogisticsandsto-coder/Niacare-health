import React, { useEffect, useState } from 'react';
import { X, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

interface ProviderOption {
  id: string;
  name: string;
}

type InviteRole = 'doctor' | 'provider_staff' | 'admin';

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, onInvited }) => {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<InviteRole>('doctor');
  const [providerId, setProviderId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    supabase.from('providers').select('id, name').order('name').then(({ data }) => {
      setProviders((data || []) as ProviderOption[]);
    });
  }, [isOpen]);

  const reset = () => {
    setEmail(''); setFullName(''); setRole('doctor'); setProviderId('');
    setJobTitle(''); setSpecialty(''); setError(''); setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('Your session has expired. Please sign in again.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          email,
          fullName,
          role,
          providerId: providerId || undefined,
          jobTitle: jobTitle || undefined,
          specialty: specialty || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Failed to send invite.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      onInvited?.();
    } catch {
      setError('Failed to reach the server. Please try again.');
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border nc-border p-5 relative" style={{ backgroundColor: 'var(--nc-surface)' }}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 nc-text-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--nc-primary)] dark:bg-primary">
            <UserPlus className="h-4 w-4 text-white dark:text-[#041D34]" />
          </div>
          <h3 className="text-sm font-semibold">Invite staff or doctor</h3>
        </div>

        {success ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-bold">Invite sent</p>
            <p className="mt-1 text-xs nc-text-muted">
              {fullName} will receive an email to set up their account.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 rounded-lg bg-[var(--nc-primary)] px-4 py-2 text-xs font-bold text-white dark:bg-primary dark:text-[#041D34]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold nc-text-secondary">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="nc-input px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-semibold nc-text-secondary">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="nc-input px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-semibold nc-text-secondary">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as InviteRole)} className="nc-input px-3 py-2">
                <option value="doctor">Doctor</option>
                <option value="provider_staff">Provider staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {(role === 'doctor' || role === 'provider_staff') && (
              <>
                <div>
                  <label className="mb-1 block font-semibold nc-text-secondary">Facility</label>
                  <select value={providerId} onChange={(e) => setProviderId(e.target.value)} required className="nc-input px-3 py-2">
                    <option value="" disabled>Select a facility…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold nc-text-secondary">Job title</label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={role === 'doctor' ? 'Doctor' : 'e.g. Receptionist'}
                    className="nc-input px-3 py-2"
                  />
                </div>
              </>
            )}
            {role === 'doctor' && (
              <div>
                <label className="mb-1 block font-semibold nc-text-secondary">Specialty</label>
                <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" className="nc-input px-3 py-2" />
              </div>
            )}

            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--nc-primary)] py-2.5 font-semibold text-white disabled:opacity-60 dark:bg-primary dark:text-[#041D34]"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? 'Sending invite…' : 'Send invite'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
