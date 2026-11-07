
import http from "node:http";

const PORT = process.env.PORT || 3000;
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const requests = new Map();

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10000) {
      throw new Error("Pedido demasiado grande");
    }
  }
  return JSON.parse(body);
}

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 20;
  const record = requests.get(ip);

  if (!record || now - record.start > windowMs) {
    requests.set(ip, { start: now, count: 1 });
    return false;
  }

  record.count++;
  return record.count > limit;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (origin && origin !== ALLOWED_ORIGIN) {
    return send(res, 403, { error: "Origem não autorizada." });
  }

  if (origin && origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return send(res, 204, {});
  }

  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, {
      status: "online",
      service: "EOA API"
    });
  }

  if (req.method === "POST" && req.url === "/chat") {
    if (rateLimited(req.socket.remoteAddress || "unknown")) {
      return send(res, 429, {
        error: "Muitas perguntas. Aguarda um pouco e tenta novamente."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return send(res, 503, {
        error: "A ligação à inteligência artificial ainda não está configurada."
      });
    }

    try {
      const body = await readBody(req);
      const question = body.message;

      if (typeof question !== "string" ||
          question.trim().length === 0 ||
          question.length > 2000) {
        return send(res, 400, {
          error: "Envia uma pergunta válida, até 2000 caracteres."
        });
      }

      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          instructions:
            "És a EOA, assistente educativa do MUNDO PLUS STUDY. " +
            "Responde em português claro, com paciência e explicações " +
            "adequadas à idade do estudante. Ajuda a compreender os " +
            "assuntos passo a passo. Não inventes factos. Se não souberes, " +
            "admite. Mantém uma conversa segura e respeitosa.",
          input: question.trim(),
          max_output_tokens: 500,
          store: false
        }),
        signal: AbortSignal.timeout(30000)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Erro da API OpenAI:", response.status);
        return send(res, 502, {
          error: "Não foi possível obter uma resposta da EOA."
        });
      }

      const answer = data.output
        ?.flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n");

      if (!answer) {
        return send(res, 502, {
          error: "A EOA não conseguiu produzir uma resposta."
        });
      }

      return send(res, 200, { reply: answer });

    } catch (error) {
      console.error("Erro no chat:", error.message);
      return send(res, 500, {
        error: "Ocorreu um problema. Tenta novamente."
      });
    }
  }

  return send(res, 404, { error: "Rota não encontrada." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`EOA API a funcionar na porta ${PORT}`);
});
