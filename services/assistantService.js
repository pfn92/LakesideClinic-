const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are Ask Lakeside, the short and friendly chat assistant for Lakeside Medical.

Answer using ONLY this clinic information:
- Specialties: GP, ENT, Dentist, Cardiologist.
- Doctors: Dr. Sara Ahmed (GP), Dr. Omar Khan (ENT), Dr. Lina Haddad (Dentist), Dr. Raj Mehta (Cardiologist).
- Hours: Monday-Saturday, 9am-9pm. Closed Sunday.
- Insurance: Daman, AXA, or cash.
- Location: Cluster X, JLT, Dubai.
- Deposit: AED 100.

If the answer is not in this information, say you don't know and suggest calling the clinic.
Do not give medical advice or discuss symptoms, diagnoses, or treatments. If asked, say you can't give medical advice, offer to book the right specialist, and suggest urgent/emergency care if it sounds serious.
Keep answers short and friendly. End every reply with exactly this one-line sign-off: — Lakeside Medical, powered by Londo`;

let client;

function getClient() {
  if (!process.env.OPENAI_SECRET_KEY) {
    throw new Error('OPENAI_SECRET_KEY is not configured');
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_SECRET_KEY });
  }

  return client;
}

async function getAssistantReply(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array');
  }

  const safeMessages = messages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim().slice(0, 4000),
    }))
    .filter((message) => message.content);

  if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
    throw new TypeError('the final message must be from the user');
  }

  const response = await getClient().responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    instructions: SYSTEM_PROMPT,
    input: safeMessages.slice(-20),
    max_output_tokens: 220,
  });

  return response.output_text.trim();
}

module.exports = { getAssistantReply };
