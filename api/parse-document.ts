import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUser } from './_lib/supabaseAuth';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';
const PERSONAL_FILES_BUCKET = 'personal-files';
const MAX_EXTRACTED_CHARS = 6000;
const MIN_EXTRACTABLE_CHARS = 30;

const SUMMARY_PROMPTS = {
  en: 'You are a clinical documentation assistant. Read the extracted text from a patient-uploaded medical document and write a concise 2-3 sentence plain-language summary of what it contains (e.g. test type, key findings, dates, medications) — suitable to store as a personal record note. Do not add any information not present in the text. Do not diagnose. Reply with only the summary, no preamble.',
  sw: 'Wewe ni msaidizi wa nyaraka za kliniki. Soma maandishi yaliyotolewa kutoka kwenye hati ya matibabu iliyopakiwa na mgonjwa, kisha andika muhtasari mfupi wa sentensi 2-3 kwa lugha rahisi kuhusu kinachomo (mf. aina ya kipimo, matokeo muhimu, tarehe, dawa) — unaofaa kuhifadhiwa kama dokezo la rekodi binafsi. Usiongeze taarifa yoyote isiyokuwepo kwenye maandishi. Usitoe utambuzi wa ugonjwa. Jibu kwa muhtasari tu, bila maelezo ya utangulizi.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    res.status(500).json({ error: 'Document parsing is not configured on the server.' });
    return;
  }

  const { client, userId, error: authError } = await getAuthedUser(req);
  if (authError || !client || !userId) {
    res.status(401).json({ error: authError || 'Not authenticated.' });
    return;
  }

  const { personalFileId, language } = (req.body || {}) as {
    personalFileId?: string;
    language?: string;
  };
  if (!personalFileId || typeof personalFileId !== 'string') {
    res.status(400).json({ error: 'personalFileId is required' });
    return;
  }

  // RLS on personal_files already scopes this to the caller's own rows.
  const { data: fileRow, error: fileError } = await client
    .from('personal_files')
    .select('file_url, pdf_file_name, title')
    .eq('id', personalFileId)
    .maybeSingle();

  if (fileError || !fileRow || !fileRow.file_url) {
    res.status(404).json({ error: 'File not found or does not belong to you.' });
    return;
  }

  const fileName = fileRow.pdf_file_name || fileRow.title || '';
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    // Groq has no vision model available on this account, so image uploads
    // (scans/photos) can't be auto-summarized yet — report that plainly
    // rather than silently doing nothing or faking a result.
    res.status(200).json({ summary: null, reason: 'unsupported_file_type' });
    return;
  }

  try {
    // Storage RLS applies the same owner-only policy here as it does to uploads.
    const { data: fileBlob, error: downloadError } = await client.storage
      .from(PERSONAL_FILES_BUCKET)
      .download(fileRow.file_url);

    if (downloadError || !fileBlob) {
      res.status(502).json({ error: downloadError?.message || 'Could not download the file.' });
      return;
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buffer);
    const extractedText = (parsed.text || '').trim();

    if (extractedText.length < MIN_EXTRACTABLE_CHARS) {
      // Likely a scanned/photographed PDF with no real text layer — same
      // limitation as image uploads, no vision model to fall back to.
      res.status(200).json({ summary: null, reason: 'no_extractable_text' });
      return;
    }

    const promptLang = language === 'sw' ? 'sw' : 'en';
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SUMMARY_PROMPTS[promptLang] },
          { role: 'user', content: extractedText.slice(0, MAX_EXTRACTED_CHARS) },
        ],
        temperature: 0.2,
        max_tokens: 220,
        reasoning_effort: 'low',
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      res.status(502).json({ error: `AI summary failed: ${errText.slice(0, 300)}` });
      return;
    }

    const groqData = await groqRes.json();
    const summary: string | undefined = groqData?.choices?.[0]?.message?.content?.trim();

    res.status(200).json({ summary: summary || null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to parse document.' });
  }
}
