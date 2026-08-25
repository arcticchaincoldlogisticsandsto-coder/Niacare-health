import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUser } from './_lib/supabaseAuth.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';
const MAX_HISTORY_MESSAGES = 12;
const MAX_RECORDS_IN_CONTEXT = 5;
const MAX_PRESCRIPTIONS_IN_CONTEXT = 5;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are NiaAI, the smart health triage assistant inside the NiaCare app (a Tanzanian digital health platform). Rules:
- You provide non-diagnostic Clinical Decision Support suggestions only — never a diagnosis, never a prescription.
- Always recommend the patient book a real consultation with a doctor (via the app's "Book Appointment" feature) for anything beyond mild/self-limiting symptoms, and urge emergency services immediately for any red-flag symptom (chest pain, difficulty breathing, severe bleeding, loss of consciousness, stroke signs).
- Keep replies short (2-4 sentences), warm, and practical — this is a mobile chat, not an essay.
- Reference Tanzanian context naturally when relevant (NHIF coverage, common conditions like malaria, local hospital referral).
- Never claim certainty about a diagnosis. Use phrasing like "this could suggest" rather than "you have."
- If the patient's real health record context is provided below, use it to personalize your guidance (e.g. flag a drug interaction with a current prescription, note a relevant recent lab result) — but never invent details that aren't in that context.`,
  sw: `Wewe ni NiaAI, msaidizi mahiri wa afya ndani ya programu ya NiaCare (jukwaa la afya la kidijitali la Tanzania). Kanuni:
- Toa mapendekezo ya kimsingi tu ya kiafya (Clinical Decision Support) — kamwe usitoe utambuzi wa ugonjwa au dawa maalum.
- Daima shauri mgonjwa aweke miadi na daktari halisi (kupitia kipengele cha "Weka Miadi" cha programu) kwa dalili zozote zaidi ya ndogo, na msisitize kupiga simu ya dharura mara moja kwa dalili hatari (maumivu ya kifua, ugumu wa kupumua, kutokwa damu nyingi, kupoteza fahamu, dalili za kiharusi).
- Jibu kwa ufupi (sentensi 2-4), kwa upole na kwa vitendo — hii ni mazungumzo ya simu, si insha.
- Tumia muktadha wa Kitanzania inapofaa (bima ya NHIF, magonjwa ya kawaida kama malaria, rufaa za hospitali).
- Kamwe usidai uhakika wa utambuzi. Tumia maneno kama "hii inaweza kuashiria" badala ya "una ugonjwa wa."
- Ikiwa muktadha wa rekodi halisi za afya za mgonjwa umetolewa hapa chini, itumie kubinafsisha ushauri wako — lakini kamwe usibuni maelezo yasiyokuwepo kwenye muktadha huo.`,
  fr: `Vous êtes NiaAI, l'assistant de triage santé intelligent de l'application NiaCare (plateforme de santé numérique tanzanienne). Règles :
- Fournissez uniquement des suggestions d'aide à la décision clinique non diagnostiques — jamais de diagnostic, jamais de prescription.
- Recommandez toujours au patient de prendre un vrai rendez-vous avec un médecin (via la fonction "Prendre RDV" de l'application) pour tout symptôme au-delà du léger, et insistez pour appeler les urgences immédiatement en cas de signe d'alerte (douleur thoracique, difficulté à respirer, saignement important, perte de conscience, signes d'AVC).
- Répondez brièvement (2-4 phrases), avec chaleur et de façon pratique — c'est un chat mobile, pas un essai.
- Faites référence au contexte tanzanien quand c'est pertinent (couverture NHIF, maladies courantes comme le paludisme, orientation hospitalière).
- N'affirmez jamais une certitude diagnostique. Utilisez des formulations comme "cela pourrait suggérer" plutôt que "vous avez."
- Si le contexte réel du dossier de santé du patient est fourni ci-dessous, utilisez-le pour personnaliser vos conseils — mais n'inventez jamais de détails absents de ce contexte.`,
};

/**
 * Pulls the signed-in patient's own real health data (via their RLS-scoped
 * client — never a service-role key) and formats it as compact context for
 * the system prompt. Returns an empty string if unauthenticated or if the
 * patient simply has no records yet, so triage still works either way.
 */
const buildPatientContext = async (req: VercelRequest): Promise<string> => {
  const { client, userId } = await getAuthedUser(req);
  if (!client || !userId) return '';

  const [{ data: profile }, { data: records }, { data: prescriptions }] = await Promise.all([
    client.from('profiles').select('blood_type, gender, dob').eq('id', userId).maybeSingle(),
    client
      .from('medical_records')
      .select('title, category, record_date, status, summary_en')
      .eq('patient_id', userId)
      .order('record_date', { ascending: false })
      .limit(MAX_RECORDS_IN_CONTEXT),
    client
      .from('prescriptions')
      .select('medication_name, dosage_instructions, is_sos')
      .eq('patient_id', userId)
      .limit(MAX_PRESCRIPTIONS_IN_CONTEXT),
  ]);

  const lines: string[] = [];

  if (profile?.blood_type) lines.push(`Blood type: ${profile.blood_type}`);
  if (profile?.dob) lines.push(`Date of birth: ${profile.dob}`);

  if (prescriptions && prescriptions.length > 0) {
    lines.push(
      'Current medications: ' +
        prescriptions
          .map((p) => `${p.medication_name}${p.dosage_instructions ? ` (${p.dosage_instructions})` : ''}${p.is_sos ? ' [as-needed]' : ''}`)
          .join('; ')
    );
  }

  if (records && records.length > 0) {
    lines.push(
      'Recent medical records: ' +
        records
          .map((r) => `${r.title} [${r.category}, ${r.record_date || 'undated'}, ${r.status}]${r.summary_en ? ` — ${r.summary_en}` : ''}`)
          .join(' | ')
    );
  }

  if (lines.length === 0) return '';

  return `\n\nPATIENT'S REAL HEALTH RECORD CONTEXT (from NiaCare's records — use to personalize, never invent beyond this):\n${lines.join('\n')}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI triage is not configured on the server.' });
    return;
  }

  const { messages, language } = (req.body || {}) as { messages?: ChatMessage[]; language?: string };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const basePrompt = SYSTEM_PROMPTS[language || 'en'] || SYSTEM_PROMPTS.en;
  const patientContext = await buildPatientContext(req);
  const systemPrompt = basePrompt + patientContext;

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-MAX_HISTORY_MESSAGES),
        ],
        temperature: 0.4,
        max_tokens: 400,
        reasoning_effort: 'low',
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      res.status(502).json({ error: `AI service error: ${errText.slice(0, 300)}` });
      return;
    }

    const data = await groqRes.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      res.status(502).json({ error: 'AI service returned an empty response.' });
      return;
    }

    res.status(200).json({ reply });
  } catch {
    res.status(500).json({ error: 'Failed to reach AI service.' });
  }
}
