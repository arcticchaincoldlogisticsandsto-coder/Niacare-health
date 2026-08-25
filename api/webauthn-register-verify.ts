import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
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

  const { attestationResponse, nickname } = (req.body || {}) as {
    attestationResponse?: RegistrationResponseJSON;
    nickname?: string;
  };
  if (!attestationResponse) {
    res.status(400).json({ error: 'attestationResponse is required.' });
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
      res.status(400).json({ error: 'No pending registration challenge. Please try again.' });
      return;
    }

    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Could not verify the biometric registration.' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const { error: insertError } = await client.from('webauthn_credentials').insert({
      patient_id: userId,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: credential.transports || null,
      nickname: nickname || null,
    });

    if (insertError) {
      res.status(500).json({ error: `Failed to save credential: ${insertError.message}` });
      return;
    }

    await client.from('webauthn_challenges').delete().eq('patient_id', userId);

    res.status(200).json({ verified: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify registration.' });
  }
}
