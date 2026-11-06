
function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return json({ error: "Origem não autorizada." }, 403);
    }

    const headers = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({
        status: "online",
        service: "EOA API"
      }), {
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      });
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Rota não encontrada." }, 404, origin);
    }

    const token = request.headers.get("Authorization");

    if (!env.EOA_ACCESS_TOKEN ||
        token !== `Bearer ${env.EOA_ACCESS_TOKEN}`) {
      return json({ error: "Acesso não autorizado." }, 401, origin);
    }

    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
      return json({ error: "Configuração incompleta." }, 503, origin);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Pedido inválido." }, 400, origin);
    }

    if (
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 4000
    ) {
      return json({ error: "Mensagem inválida." }, 400, origin);
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL,
            store: false,
            instructions:
              "És a EOA, assistente educativa do MUNDO PLUS STUDY. " +
              "Ensina com clareza, paciência e exemplos. " +
              "Ajuda os estudantes a compreenderem as matérias.",
            input: body.message
          })
        }
      );

      if (!response.ok) {
        return json({
          error: "Não foi possível obter uma resposta."
        }, 502, origin);
      }

      const result = await response.json();

      const answer = (result.output || [])
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n");

      return json({ answer }, 200, origin);

    } catch {
      return json({
        error: "Falha de ligação. Tenta novamente."
      }, 502, origin);
    }
  }
};
