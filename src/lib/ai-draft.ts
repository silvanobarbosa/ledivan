// Rascunho de mensagem ao paciente com IA — via GATEWAY da casa (ReverbLabs_AI), nunca provider
// direto. Modelo PESADO (rl-heavy): vira texto que o terapeuta manda ao paciente (assistido — ele
// SEMPRE revisa antes de enviar). Gated: sem env do gateway → null (o botão só some/avisa).
const BASE = () => (process.env.REVERBLABS_AI_BASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.REVERBLABS_AI_KEY || "";

export function aiDraftConfigured(): boolean {
  return !!(BASE() && KEY());
}

export async function draftMessage(opts: { intent: string; patientName?: string; therapistName?: string; tone?: string }): Promise<string | null> {
  if (!aiDraftConfigured() || !opts.intent?.trim()) return null;
  const sys = `Você é assistente de um(a) psicólogo(a). Escreva UMA mensagem curta, calorosa e profissional em PT-BR pra enviar ao paciente por WhatsApp. Trate por "você". Sem diagnóstico, sem promessa clínica, sem jargão. No máximo ~400 caracteres. Responda SÓ com a mensagem final, sem aspas nem explicação.`;
  const user = [
    opts.patientName ? `Paciente: ${opts.patientName}.` : "",
    opts.therapistName ? `Terapeuta (assina): ${opts.therapistName}.` : "",
    opts.tone ? `Tom: ${opts.tone}.` : "",
    `O que o terapeuta quer dizer: ${opts.intent.trim()}`,
  ].filter(Boolean).join("\n");
  try {
    const res = await fetch(`${BASE()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.REVERBLABS_AI_MODEL || "rl-heavy",
        temperature: 0.7,
        max_tokens: 300,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j?.choices?.[0]?.message?.content?.trim();
    return text ? text.replace(/^["']|["']$/g, "").slice(0, 600) : null;
  } catch {
    return null;
  }
}
