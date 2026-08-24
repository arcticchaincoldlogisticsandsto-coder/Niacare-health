import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUser } from './_lib/supabaseAuth';

const DAILY_API_URL = 'https://api.daily.co/v1';
// Rooms auto-expire 4 hours after creation so stale telehealth rooms don't linger.
const ROOM_TTL_SECONDS = 4 * 60 * 60;
// Meeting tokens are short-lived — minted fresh each time a participant joins.
const TOKEN_TTL_SECONDS = 60 * 60;

const sanitizeRoomName = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

const dailyFetch = (apiKey: string, path: string, init?: RequestInit) =>
  fetch(`${DAILY_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers || {}),
    },
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Telehealth video is not configured on the server.' });
    return;
  }

  // Require the caller's own Supabase session — a room+token must never be
  // mintable just by knowing/guessing a ticket number.
  const { client, userId, error: authError } = await getAuthedUser(req);
  if (authError || !client || !userId) {
    res.status(401).json({ error: authError || 'Not authenticated.' });
    return;
  }

  const { ticketNumber, participantName } = (req.body || {}) as {
    ticketNumber?: string;
    participantName?: string;
  };

  if (!ticketNumber || typeof ticketNumber !== 'string') {
    res.status(400).json({ error: 'ticketNumber is required' });
    return;
  }

  // Confirm this appointment actually belongs to the caller (RLS on
  // `appointments` already enforces patient_id = auth.uid(), so this select
  // simply returns nothing for someone else's ticket) and is telehealth.
  const { data: appointment, error: apptError } = await client
    .from('appointments')
    .select('id, consultation_type, status')
    .eq('ticket_number', ticketNumber)
    .maybeSingle();

  if (apptError || !appointment) {
    res.status(403).json({ error: 'This appointment does not belong to you or was not found.' });
    return;
  }
  if (appointment.consultation_type !== 'telehealth') {
    res.status(400).json({ error: 'This appointment is not a telehealth consultation.' });
    return;
  }
  if (appointment.status === 'cancelled') {
    res.status(400).json({ error: 'This appointment has been cancelled.' });
    return;
  }

  const roomName = `niacare-${sanitizeRoomName(ticketNumber)}`;

  try {
    // Idempotent room lookup — one telehealth appointment gets one durable room,
    // reused every time the patient (or clinician) rejoins.
    let roomUrl: string | null = null;
    const existing = await dailyFetch(apiKey, `/rooms/${roomName}`);

    if (existing.ok) {
      const existingRoom = await existing.json();
      roomUrl = existingRoom.url;
    } else if (existing.status === 404) {
      const created = await dailyFetch(apiKey, '/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
            enable_screenshare: true,
            enable_chat: true,
            max_participants: 4,
            enable_prejoin_ui: true,
          },
        }),
      });

      if (!created.ok) {
        const errText = await created.text();
        res.status(502).json({ error: `Failed to create video room: ${errText.slice(0, 300)}` });
        return;
      }
      const createdRoom = await created.json();
      roomUrl = createdRoom.url;
    } else {
      const errText = await existing.text();
      res.status(502).json({ error: `Video service error: ${errText.slice(0, 300)}` });
      return;
    }

    if (!roomUrl) {
      res.status(502).json({ error: 'Video room did not return a URL.' });
      return;
    }

    // Room is private, so every participant needs a signed meeting token to join.
    const tokenRes = await dailyFetch(apiKey, '/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: (participantName || 'Patient').slice(0, 60),
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      res.status(502).json({ error: `Failed to create meeting token: ${errText.slice(0, 300)}` });
      return;
    }

    const tokenData = await tokenRes.json();
    res.status(200).json({ url: roomUrl, token: tokenData.token, roomName });
  } catch {
    res.status(500).json({ error: 'Failed to reach video service.' });
  }
}
