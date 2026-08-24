import { supabase } from './supabaseClient';

export interface ParseDocumentResult {
  summary: string | null;
  reason?: 'unsupported_file_type' | 'no_extractable_text';
  error?: string;
}

/**
 * Asks the server to extract text from an uploaded PDF and summarize it via
 * Groq. Image uploads (scans/photos) and PDFs with no real text layer both
 * come back with summary: null — there's no vision model available on this
 * Groq account, so those genuinely can't be auto-parsed yet.
 */
export const requestDocumentSummary = async (
  personalFileId: string,
  language: string
): Promise<ParseDocumentResult> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { summary: null, error: 'Not signed in.' };

    const response = await fetch('/api/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ personalFileId, language }),
    });

    const data = await response.json();
    if (!response.ok) return { summary: null, error: data?.error || 'Failed to parse document.' };
    return { summary: data.summary ?? null, reason: data.reason };
  } catch {
    return { summary: null, error: 'Failed to reach the document parsing service.' };
  }
};
