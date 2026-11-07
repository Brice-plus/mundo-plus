import http from "node:http";

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: "online",
      service: "EOA API"
    }));
  }

  if (req.url === "/chat" && req.method === "POST") {
    res.writeHead(503);
    return res.end(JSON.stringify({
      error: "A ligação à inteligência artificial ainda está a ser configurada."
    }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Rota não encontrada." }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`EOA API a funcionar na porta ${PORT}`);
});
