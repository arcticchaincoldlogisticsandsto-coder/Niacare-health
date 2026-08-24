export interface VideoRoomInfo {
  url: string;
  token: string;
  roomName: string;
}

/**
 * Asks the server (api/video-room.ts) for a real Daily.co room + a signed
 * meeting token for this participant. The Daily API key never reaches the
 * browser — same pattern as api/triage.ts for the Groq key.
 */
export const requestVideoRoom = async (
  ticketNumber: string,
  participantName: string
): Promise<{ room?: VideoRoomInfo; error?: string }> => {
  try {
    const response = await fetch('/api/video-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
