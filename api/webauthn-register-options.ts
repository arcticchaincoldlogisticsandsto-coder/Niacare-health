import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getAuthedUser, getRpConfig } from './_lib/supabaseAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { client, userId, error } = await getAuthedUser(req);
  if (error || !client || !userId) {
    res.status(401).json({ error: error || 'Not authenticated.' });
    return;
  }

  const { patientName } = (req.body || {}) as { patientName?: string };
  const { rpID, rpName } = getRpConfig(req);

  try {
    const { data: existing } = await client
      .from('webauthn_credentials')
      .select('credential_id, transports')
      .eq('patient_id', userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: patientName || 'NiaCare Patient',
      attestationType: 'none',
      excludeCredentials: (existing || []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    const { error: upsertError } = await client
      .from('webauthn_challenges')
      .upsert({ patient_id: userId, challenge: options.challenge, updated_at: new Date().toISOString() });

    if (upsertError) {
      res.status(500).json({ error: `Failed to store challenge: ${upsertError.message}` });
      return;
    }

    res.status(200).json(options);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate registration options.' });
  }
}
