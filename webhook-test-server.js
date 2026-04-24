const http = require("http")

const PORT = Number(process.env.WEBHOOK_TEST_PORT || 8787)
const HOST = process.env.WEBHOOK_TEST_HOST || "127.0.0.1"

const received = []

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET"
  const url = req.url || "/"

  if (method === "GET" && url === "/health") {
    sendJson(res, 200, { ok: true, status: "up" })
    return
  }

  if (method === "GET" && url === "/last") {
    const last = received[received.length - 1] ?? null
    sendJson(res, 200, { ok: true, count: received.length, last })
    return
  }

  if (method === "GET" && url === "/events") {
    sendJson(res, 200, { ok: true, count: received.length, events: received })
    return
  }

  if (method === "POST" && url === "/webhook") {
    try {
      const raw = await readBody(req)
      const parsed = raw ? JSON.parse(raw) : {}
      const event = {
        receivedAt: new Date().toISOString(),
        headers: req.headers,
        body: parsed,
      }
      received.push(event)
      console.log("\n[webhook-test] Novo evento recebido:")
      console.log(JSON.stringify(event, null, 2))
      sendJson(res, 200, { ok: true, message: "Webhook recebido", count: received.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 400, { ok: false, error: "JSON inválido no body.", details: message })
    }
    return
  }

  sendJson(res, 404, {
    ok: false,
    error: "Rota não encontrada.",
    routes: ["GET /health", "GET /last", "GET /events", "POST /webhook"],
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[webhook-test] Rodando em http://${HOST}:${PORT}`)
  console.log("[webhook-test] Endpoint para configurar no app: POST /webhook")
})
