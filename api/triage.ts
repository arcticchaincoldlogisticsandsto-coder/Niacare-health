import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';
const MAX_HISTORY_MESSAGES = 12;

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
- Never claim certainty about a diagnosis. Use phrasing like "this could suggest" rather than "you have."`,
  sw: `Wewe ni NiaAI, msaidizi mahiri wa afya ndani ya programu ya NiaCare (jukwaa la afya la kidijitali la Tanzania). Kanuni:
- Toa mapendekezo ya kimsingi tu ya kiafya (Clinical Decision Support) — kamwe usitoe utambuzi wa ugonjwa au dawa maalum.
- Daima shauri mgonjwa aweke miadi na daktari halisi (kupitia kipengele cha "Weka Miadi" cha programu) kwa dalili zozote zaidi ya ndogo, na msisitize kupiga simu ya dharura mara moja kwa dalili hatari (maumivu ya kifua, ugumu wa kupumua, kutokwa damu nyingi, kupoteza fahamu, dalili za kiharusi).
- Jibu kwa ufupi (sentensi 2-4), kwa upole na kwa vitendo — hii ni mazungumzo ya simu, si insha.
- Tumia muktadha wa Kitanzania inapofaa (bima ya NHIF, magonjwa ya kawaida kama malaria, rufaa za hospitali).
- Kamwe usidai uhakika wa utambuzi. Tumia maneno kama "hii inaweza kuashiria" badala ya "una ugonjwa wa."`,
  fr: `Vous êtes NiaAI, l'assistant de triage santé intelligent de l'application NiaCare (plateforme de santé numérique tanzanienne). Règles :
- Fournissez uniquement des suggestions d'aide à la décision clinique non diagnostiques — jamais de diagnostic, jamais de prescription.
- Recommandez toujours au patient de prendre un vrai rendez-vous avec un médecin (via la fonction "Prendre RDV" de l'application) pour tout symptôme au-delà du léger, et insistez pour appeler les urgences immédiatement en cas de signe d'alerte (douleur thoracique, difficulté à respirer, saignement important, perte de conscience, signes d'AVC).
- Répondez brièvement (2-4 phrases), avec chaleur et de façon pratique — c'est un chat mobile, pas un essai.
- Faites référence au contexte tanzanien quand c'est pertinent (couverture NHIF, maladies courantes comme le paludisme, orientation hospitalière).
- N'affirmez jamais une certitude diagnostique. Utilisez des formulations comme "cela pourrait suggérer" plutôt que "vous avez."`,
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

  const systemPrompt = SYSTEM_PROMPTS[language || 'en'] || SYSTEM_PROMPTS.en;

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
