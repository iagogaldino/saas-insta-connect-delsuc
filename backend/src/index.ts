import express from "express";
import type { Response } from "express";
import { createInstaConnect, type DmTapEvent, type InstaConnect } from "insta-connect-delsuc";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const headless = process.env.INSTA_HEADLESS === "1" || process.env.INSTA_HEADLESS === "true";

let instaClient: InstaConnect | null = null;

function getInstaConnect(): InstaConnect {
  if (!instaClient) {
    instaClient = createInstaConnect(
      { basePath: process.cwd(), headless },
      (launch) => ({ ...launch, slowMo: 0 }),
    );
  }
  return instaClient;
}

/** Clientes conectados via SSE; cada `dmTap` da lib replicado com `event: dmtap`. */
const dmTapSseClients = new Set<Response>();
let dmTapEnsurePromise: Promise<void> | null = null;

function writeSse(res: Response, event: string, payload: unknown) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const broadcastDmTap: (evt: DmTapEvent) => void = (evt) => {
  for (const r of dmTapSseClients) {
    if (r.writableEnded) {
      dmTapSseClients.delete(r);
      continue;
    }
    try {
      writeSse(r, "dmtap", evt);
    } catch {
      dmTapSseClients.delete(r);
    }
  }
};

async function ensureDmTapForSse() {
  const client = getInstaConnect();
  if (client.isDmTapActive()) return;
  if (dmTapEnsurePromise) {
    await dmTapEnsurePromise;
    return;
  }
  dmTapEnsurePromise = (async () => {
    if (client.isDmTapActive()) return;
    await client.startDmTap(broadcastDmTap, undefined);
  })();
  try {
    await dmTapEnsurePromise;
  } finally {
    dmTapEnsurePromise = null;
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/** Confirma que a biblioteca está resolvida (sem abrir o Chromium). */
app.get("/test/insta-connect", (_req, res) => {
  res.json({
    ok: true,
    createInstaConnect: typeof createInstaConnect,
    hint: "Use POST /test/insta-connect/launch para subir e derrubar o Chromium (factory do README).",
  });
});

/**
 * Teste mínimo do README: `createInstaConnect` + `launch` + `close`.
 * A primeira execução pode demorar (download do Chromium pelo puppeteer).
 */
app.post("/test/insta-connect/launch", async (_req, res) => {
  const client = createInstaConnect(
    { basePath: process.cwd(), headless: true },
    (launch) => ({ ...launch, slowMo: 0 }),
  );
  try {
    await client.launch();
    await client.close();
    res.json({ ok: true, message: "Chromium iniciou e fechou; integração básica OK." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body JSON opcional: `{ "username", "password" }` — chama `login()` (submissão do formulário).
 * Se os dois forem omitidos ou vazios, só chama `openLoginPage()`.
 * Reutiliza a mesma instância; `INSTA_HEADLESS=1` desativa a janela do Chrome.
 */
app.post("/insta/open-login", async (req, res) => {
  const client = getInstaConnect();
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const hasUser = username.length > 0;
  const hasPass = password.length > 0;
  if (hasUser !== hasPass) {
    res.status(400).json({
      ok: false,
      error: "Inclua `username` e `password` juntos no JSON, ou envie body vazio `{}` para só abrir a tela de login.",
    });
    return;
  }
  try {
    if (hasUser && hasPass) {
      const result = await client.login(username, password);
      res.json({ ok: true, headless, ...result });
      return;
    }
    const url = await client.openLoginPage();
    res.json({ ok: true, url, headless });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body: `{ "conversationTitle", "dedicatedTab"?: boolean }` — abre a thread no Chromium (navegação /direct/t/...).
 * `conversationTitle` é o mesmo título visto em `listConversations` (ex.: nome da pessoa no inbox).
 */
app.post("/insta/open-conversation", async (req, res) => {
  const client = getInstaConnect();
  const conversationTitle =
    typeof req.body?.conversationTitle === "string" ? req.body.conversationTitle.trim() : "";
  if (!conversationTitle) {
    res.status(400).json({ ok: false, error: "conversationTitle é obrigatório." });
    return;
  }
  const dedicatedTab = req.body?.dedicatedTab === true;
  try {
    const result = await client.openConversationByTitle(conversationTitle, { dedicatedTab });
    res.json({ ok: true, headless, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/messages?threadId=...&limit=20` — mensagens visíveis na thread (Puppeteer no DOM). */
app.get("/insta/messages", async (req, res) => {
  const client = getInstaConnect();
  const raw = req.query.threadId;
  const threadId = typeof raw === "string" ? raw.trim() : "";
  if (!threadId) {
    res.status(400).json({ ok: false, error: "Query `threadId` é obrigatório." });
    return;
  }
  const limitParam = req.query.limit;
  let limit = 30;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser entre 1 e 200." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }
  try {
    const result = await client.listMessagesByThreadId(threadId, limit);
    res.json({ ok: true, headless, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/** `GET /insta/conversations?limit=20` — requer sessão autenticada (login prévio no mesmo processo). */
app.get("/insta/conversations", async (req, res) => {
  const client = getInstaConnect();
  const limitParam = req.query.limit;
  let limit = 20;
  if (typeof limitParam === "string" && limitParam.length > 0) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      res.status(400).json({ ok: false, error: "Query `limit` deve ser um número entre 1 e 200." });
      return;
    }
    limit = n;
  } else if (Array.isArray(limitParam)) {
    res.status(400).json({ ok: false, error: "Use um único parâmetro `limit`." });
    return;
  }
  try {
    const conversations = await client.listConversations(limit);
    res.json({ ok: true, count: conversations.length, limit, headless, conversations });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Body JSON: `{ "conversationTitle", "text", "dedicatedTab"?: boolean }` — título visível na inbox (igual a `listConversations`), texto da DM.
 * Requer sessão autenticada; a lib simula teclado no Web (pode levar ~15–25s).
 */
app.post("/insta/messages", async (req, res) => {
  const client = getInstaConnect();
  const conversationTitle =
    typeof req.body?.conversationTitle === "string" ? req.body.conversationTitle.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!conversationTitle || !text) {
    res.status(400).json({
      ok: false,
      error: "O body deve incluir `conversationTitle` (string não vazia) e `text` (string).",
    });
    return;
  }
  const dedicatedTab = req.body?.dedicatedTab === true;
  try {
    const result = await client.sendMessageToConversation(conversationTitle, text, { dedicatedTab });
    res.json({ ok: true, headless, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Conexão longa (SSE). O servidor inicia o `startDmTap` da lib (MQTT/WebSocket do IG) e
 * reenvia cada DmTapEvent como `event: dmtap` no corpo. Requer sessão já logada; use em paralelo
 * com `POST /insta/open-login` antes. CORS: defina `CORS_ORIGIN` (padrão `*`) se o front for outro host.
 * No browser: `const es = new EventSource("http://127.0.0.1:3000/insta/realtime/dm");
 *   es.addEventListener("dmtap", (e) => console.log(JSON.parse((e as MessageEvent).data)));`
 */
app.get("/insta/realtime/dm", async (req, res) => {
  const allowOrigin = process.env.CORS_ORIGIN ?? "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  res.write(`: sse ok\n\n`);
  dmTapSseClients.add(res);

  const remove = () => {
    dmTapSseClients.delete(res);
  };
  req.on("close", remove);
  res.on("close", remove);

  try {
    await ensureDmTapForSse();
    writeSse(res, "system", { ok: true, message: "dmTap ativo; aguardando mensagens." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    writeSse(res, "system", { ok: false, error: message });
    remove();
    res.end();
  }
});

/** Desliga o dmTap (para de alimentar o SSE com novas mensagens). Conexões SSE podem permanecer abertas, mas vazias. */
app.post("/insta/realtime/dm-tap/stop", (_req, res) => {
  try {
    getInstaConnect().stopDmTap();
    res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
