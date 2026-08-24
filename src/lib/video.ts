import { supabase } from './supabaseClient';

export interface VideoRoomInfo {
  url: string;
  token: string;
  roomName: string;
}

/**
 * Asks the server (api/video-room.ts) for a real Daily.co room + a signed
 * meeting token for this participant. The Daily API key never reaches the
 * browser — same pattern as api/triage.ts for the Groq key. Requires a real
 * Supabase session: the server verifies the caller actually owns this
 * appointment before minting a token.
 */
export const requestVideoRoom = async (
  ticketNumber: string,
  participantName: string
): Promise<{ room?: VideoRoomInfo; error?: string }> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return { error: 'You must be signed in to join a video call.' };
    }

    const response = await fetch('/api/video-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ticketNumber, participantName }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: data?.error || 'Failed to reach video service.' };
    }
    return { room: { url: data.url, token: data.token, roomName: data.roomName } };
  } catch {
    return { error: 'Failed to reach video service.' };
  }
};
