import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
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

  const { rpID } = getRpConfig(req);

  try {
    const { data: credentials, error: fetchError } = await client
      .from('webauthn_credentials')
      .select('credential_id, transports')
      .eq('patient_id', userId);

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!credentials || credentials.length === 0) {
      res.status(404).json({ error: 'No biometric credential is registered yet on this account.' });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as any,
      })),
      userVerification: 'required',
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
    res.status(500).json({ error: err?.message || 'Failed to generate authentication options.' });
  }
}
