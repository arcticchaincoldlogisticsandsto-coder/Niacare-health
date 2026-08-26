import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from './_lib/supabaseAuth.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type InviteRole = 'doctor' | 'provider_staff' | 'admin';
const ALLOWED_ROLES: InviteRole[] = ['doctor', 'provider_staff', 'admin'];

interface InviteBody {
  email?: string;
  fullName?: string;
  role?: InviteRole;
  providerId?: string;
  jobTitle?: string;
  department?: string;
  specialty?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Staff invitations are not configured on the server.' });
    return;
  }

  // Verify the caller is a real, currently-authenticated admin using their
  // own RLS-scoped session — never trust a role claim from the request body.
  const { client: callerClient, error: authError } = await getAuthedUser(req);
  if (!callerClient || authError) {
    res.status(401).json({ error: authError || 'Not authenticated.' });
    return;
  }
  const { data: isAdmin, error: isAdminError } = await callerClient.rpc('is_admin');
  if (isAdminError || !isAdmin) {
    res.status(403).json({ error: 'Only an administrator can invite staff.' });
    return;
  }

  const { email, fullName, role, providerId, jobTitle, department, specialty } = (req.body || {}) as InviteBody;

  if (!email || !fullName || !role || !ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: 'email, fullName, and a valid role are required.' });
    return;
  }
  if ((role === 'doctor' || role === 'provider_staff') && !providerId) {
    res.status(400).json({ error: 'providerId is required for doctor and provider_staff invites.' });
    return;
  }

  // Service-role client: bypasses RLS, so it's used only for this narrow,
  // admin-gated provisioning flow — never exposed to the browser.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData?.user) {
    res.status(502).json({ error: inviteError?.message || 'Failed to send invite email.' });
    return;
  }
  const newUserId = inviteData.user.id;

  const rollback = async () => {
    await adminClient.auth.admin.deleteUser(newUserId).catch(() => undefined);
  };

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: newUserId,
    user_category: 'locals',
    role,
    status: 'active',
    full_name: fullName,
    email,
  });
  if (profileError) {
    await rollback();
    res.status(500).json({ error: `Failed to create profile: ${profileError.message}` });
    return;
  }

  if (role === 'doctor' || role === 'provider_staff') {
    const { error: staffError } = await adminClient.from('provider_staff').insert({
      user_id: newUserId,
      provider_id: providerId,
      job_title: jobTitle || (role === 'doctor' ? 'Doctor' : 'Staff'),
      department: department || null,
    });
    if (staffError) {
      await rollback();
      res.status(500).json({ error: `Failed to create staff record: ${staffError.message}` });
      return;
    }

    // provider_staff insert trigger auto-creates a blank doctor_profiles row
    // when the job title looks like a clinician; fill in the real specialty
    // the admin chose instead of leaving the trigger's generic default.
    if (role === 'doctor') {
      if (specialty) {
        await adminClient.from('doctor_profiles').update({ specialty }).eq('user_id', newUserId);
      }

      const { data: doctorProfile } = await adminClient
        .from('doctor_profiles')
        .select('id')
        .eq('user_id', newUserId)
        .maybeSingle();

      // A brand-new doctor otherwise has zero rows in doctor_schedule and is
      // literally unbookable (book_appointment() only reserves real slots).
      // Seed a standard two-week weekday availability window so they're
      // immediately bookable; the doctor can adjust it later.
      if (doctorProfile) {
        const STANDARD_SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'];
        const slotRows: { doctor_profile_id: string; schedule_date: string; time_slot: string }[] = [];
        const cursor = new Date();
        let daysAdded = 0;
        while (daysAdded < 10) {
          cursor.setDate(cursor.getDate() + 1);
          const day = cursor.getDay();
          if (day === 0 || day === 6) continue; // weekends
          const dateIso = cursor.toISOString().slice(0, 10);
          for (const slot of STANDARD_SLOTS) {
            slotRows.push({ doctor_profile_id: doctorProfile.id, schedule_date: dateIso, time_slot: slot });
          }
          daysAdded += 1;
        }
        await adminClient.from('doctor_schedule').upsert(slotRows, {
          onConflict: 'doctor_profile_id,schedule_date,time_slot',
          ignoreDuplicates: true,
        });
      }
    }
  }

  res.status(200).json({ success: true, userId: newUserId });
}
