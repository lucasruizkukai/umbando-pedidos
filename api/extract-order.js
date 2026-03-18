const DEFAULT_ORDER = {
  nome: "",
  contato: "",
  canal: "WhatsApp",
  tipo: "Guia",
  fios: "3",
  mat: "Miçanga",
  matd: "",
  cores: "",
  fin: "Fio solto",
  fqtd: "",
  fcor: "",
  ffmt: "",
  ping: false,
  pqtd: "",
  pqual: "",
  pmetal: "Prateado",
  fio: "Nylon",
  fech: "Com firma",
  env: "Fechado",
  tam: "60cm",
  transp: "",
  frete: "",
  pgto: "Pix",
  parc: "",
  valor: "",
  desconto: false,
  urg: false,
  taxa: "",
  obs: "",
  status: "Novo",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "A IA não está configurada no Vercel. Cadastre ANTHROPIC_API_KEY nas variáveis de ambiente." });
  }

  const { conversation, channel } = req.body || {};
  if (!conversation?.trim()) {
    return res.status(400).json({ error: "Conversa vazia." });
  }

  const prompt = `
Você extrai pedidos de guias e brajás de Umbanda.
Analise a conversa e retorne apenas um JSON válido com estas chaves:
${JSON.stringify(DEFAULT_ORDER, null, 2)}

Regras:
- Use "Guia" ou "Brajá" em tipo.
- Use somente valores coerentes com a conversa.
- Preserve campos vazios quando a informação não existir.
- "canal" deve ser "${channel || "WhatsApp"}".

Conversa:
"""${conversation}"""
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const rawText = await response.text();
    let payload = null;

    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Anthropic retornou erro.",
        details: payload?.error?.message || rawText || `HTTP ${response.status}`,
      });
    }

    if (!payload) {
      return res.status(502).json({
        error: "Anthropic retornou resposta vazia ou inválida.",
        details: rawText || "Sem conteúdo na resposta.",
      });
    }

    const text = payload?.content?.map((item) => item.text || "").join("") || "";
    if (!text.trim()) {
      return res.status(502).json({
        error: "Anthropic não retornou texto utilizável.",
        details: JSON.stringify(payload),
      });
    }

    const order = JSON.parse(text.replace(/```json|```/g, "").trim());

    return res.status(200).json({ order: { ...DEFAULT_ORDER, ...order, canal: order.canal || channel || "WhatsApp" } });
  } catch (error) {
    return res.status(500).json({ error: "Falha ao processar a conversa com IA.", details: String(error?.message || error) });
  }
}
