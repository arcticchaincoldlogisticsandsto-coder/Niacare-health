import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getAuthedUser, getRpConfig } from './_lib/supabaseAuth.js';

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

  const { assertionResponse } = (req.body || {}) as { assertionResponse?: AuthenticationResponseJSON };
  if (!assertionResponse) {
    res.status(400).json({ error: 'assertionResponse is required.' });
    return;
  }

  const { rpID, origin } = getRpConfig(req);

  try {
    const { data: challengeRow } = await client
      .from('webauthn_challenges')
      .select('challenge')
      .eq('patient_id', userId)
      .maybeSingle();

    if (!challengeRow?.challenge) {
      res.status(400).json({ error: 'No pending authentication challenge. Please try again.' });
      return;
    }

    const { data: credentialRow, error: credError } = await client
      .from('webauthn_credentials')
      .select('*')
      .eq('patient_id', userId)
      .eq('credential_id', assertionResponse.id)
      .maybeSingle();

    if (credError || !credentialRow) {
      res.status(400).json({ error: 'This biometric credential is not registered on your account.' });
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialRow.credential_id,
        publicKey: isoBase64URL.toBuffer(credentialRow.public_key),
        counter: credentialRow.counter,
        transports: credentialRow.transports || undefined,
      },
    });

    if (!verification.verified) {
      res.status(400).json({ error: 'Could not verify the biometric sign-in.' });
      return;
    }

    await client
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq('id', credentialRow.id);

    await client.from('webauthn_challenges').delete().eq('patient_id', userId);

    res.status(200).json({ verified: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify authentication.' });
  }
}
