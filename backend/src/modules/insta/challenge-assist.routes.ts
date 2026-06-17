import { Router, type Request, type Response } from "express";
import type { InstaConnect } from "insta-connect-delsuc";
import { parseBearerToken, requireAuth, verifyAccessToken } from "../auth/auth.middleware";

function readAccessToken(req: Request): string | null {
  const headerToken = parseBearerToken(req.header("authorization") ?? "");
  if (headerToken) {
    return headerToken;
  }
  const queryToken = req.query.accessToken;
  return typeof queryToken === "string" && queryToken.trim() ? queryToken.trim() : null;
}

function challengeAssistHtml(sessionId: string, basePath: string, accessToken: string): string {
  const safeSessionId = JSON.stringify(sessionId);
  const safeBasePath = JSON.stringify(basePath);
  const safeAccessToken = JSON.stringify(accessToken);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
  <title>Insta Connect — Verificação remota</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    body {
      background: #0f1115;
      transition: background 0.45s ease;
    }
    body.login-success {
      background: linear-gradient(160deg, #14532d 0%, #166534 45%, #15803d 100%);
      color: #f0fdf4;
      overflow: auto;
    }
    .challenge-ui {
      position: fixed;
      inset: 0;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      background: #0f1115;
    }
    .challenge-ui.hidden { display: none !important; }
    .viewport-wrap {
      transform-origin: top left;
      will-change: transform;
    }
    #viewport {
      display: block;
      cursor: crosshair;
      touch-action: manipulation;
      background: #111;
      user-select: none;
      -webkit-user-drag: none;
    }
    .success-screen {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 100vh;
      padding: 24px 16px;
      animation: successFadeIn 0.5s ease;
    }
    body.login-success .success-screen { display: flex; }
    @keyframes successFadeIn {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .success-icon {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      border: 3px solid rgba(255, 255, 255, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    }
    .success-icon svg { width: 52px; height: 52px; stroke: #fff; stroke-width: 3.5; fill: none; }
    .success-title {
      font-size: 1.65rem;
      font-weight: 700;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    .success-message {
      font-size: 1.05rem;
      line-height: 1.55;
      max-width: 420px;
      margin: 0;
      opacity: 0.95;
    }
  </style>
</head>
<body>
  <div id="successScreen" class="success-screen" aria-live="polite">
    <div class="success-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2 class="success-title">Login realizado!</h2>
    <p class="success-message">Sua conta Instagram foi conectada com sucesso. Pode fechar esta página e voltar ao app.</p>
  </div>

  <main id="challengeUi" class="challenge-ui">
    <div id="viewportWrap" class="viewport-wrap">
      <img id="viewport" alt="Verificação reCAPTCHA" draggable="false" />
    </div>
  </main>
  <script>
    const sessionId = ${safeSessionId};
    const basePath = ${safeBasePath};
    const accessToken = ${safeAccessToken};
    const imgEl = document.getElementById("viewport");
    const viewportWrap = document.getElementById("viewportWrap");
    const challengeUi = document.getElementById("challengeUi");
    let pollTimer = null;
    let viewportWidth = 1000;
    let viewportHeight = 600;
    let displayScale = 1;
    let loginSuccessShown = false;
    let shouldCenterScroll = true;
    let suppressClickUntil = 0;

    function authHeaders(extra) {
      return { authorization: "Bearer " + accessToken, ...(extra || {}) };
    }

    function computeDisplayScale() {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const fitWidth = ww / viewportWidth;
      const fitHeight = wh / viewportHeight;
      const cover = Math.max(fitWidth, fitHeight);
      const isMobile = ww < 900 || ("ontouchstart" in window && ww < 1200);
      if (isMobile) {
        return Math.max(cover, fitWidth * 2.4, 1.75);
      }
      return Math.max(cover, fitWidth, 1);
    }

    function applyDisplayScale() {
      if (!viewportWrap || !imgEl) return;
      displayScale = computeDisplayScale();
      imgEl.style.width = viewportWidth + "px";
      imgEl.style.height = viewportHeight + "px";
      viewportWrap.style.width = Math.ceil(viewportWidth * displayScale) + "px";
      viewportWrap.style.height = Math.ceil(viewportHeight * displayScale) + "px";
      viewportWrap.style.transform = "scale(" + displayScale + ")";
      if (shouldCenterScroll && challengeUi) {
        requestAnimationFrame(function() {
          challengeUi.scrollLeft = Math.max(0, (viewportWrap.offsetWidth - window.innerWidth) / 2);
          challengeUi.scrollTop = Math.max(0, (viewportWrap.offsetHeight - window.innerHeight) / 2);
        });
      }
    }

    window.addEventListener("resize", function() {
      applyDisplayScale();
    });

    function notifyEmbedHost() {
      const payload = { type: "insta-connect:challenge-login-success", sessionId: sessionId };
      try {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch {}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        }
      } catch {}
    }

    function showLoginSuccess() {
      if (loginSuccessShown) return;
      loginSuccessShown = true;
      document.body.classList.add("login-success");
      document.title = "Insta Connect — Login concluído";
      if (challengeUi) challengeUi.classList.add("hidden");
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      notifyEmbedHost();
    }

    async function fetchStatus() {
      const res = await fetch(basePath + "/status", { cache: "no-store", headers: authHeaders() });
      return res.json();
    }

    async function refreshScreenshot() {
      const res = await fetch(basePath + "/screenshot.json?t=" + Date.now(), { cache: "no-store", headers: authHeaders() });
      if (!res.ok) throw new Error("Falha ao capturar tela (" + res.status + ")");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Falha ao capturar tela");
      viewportWidth = data.width || viewportWidth;
      viewportHeight = data.height || viewportHeight;
      imgEl.src = "data:image/png;base64," + data.base64;
      applyDisplayScale();
      return data;
    }

    async function relayClick(x, y) {
      const res = await fetch(basePath + "/click", {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ x, y }),
      });
      return res.json();
    }

    async function tick() {
      try {
        const status = await fetchStatus();
        if (!status.ok) return;
        if (status.loggedIn) {
          showLoginSuccess();
          return;
        }
        await refreshScreenshot();
      } catch {
        // Mantém a última captura visível; próximo poll tenta de novo.
      }
    }

    async function relayClickAt(clientX, clientY) {
      const rect = imgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = viewportWidth / rect.width;
      const scaleY = viewportHeight / rect.height;
      const x = Math.round((clientX - rect.left) * scaleX);
      const y = Math.round((clientY - rect.top) * scaleY);
      shouldCenterScroll = false;
      const result = await relayClick(x, y);
      if (!result.ok) throw new Error(result.error || "Falha ao enviar clique");
      await tick();
    }

    imgEl.addEventListener("click", async (event) => {
      if (Date.now() < suppressClickUntil) return;
      event.preventDefault();
      try {
        await relayClickAt(event.clientX, event.clientY);
      } catch {
        // Ignora erro visual; usuário pode clicar novamente.
      }
    });

    imgEl.addEventListener("touchend", async (event) => {
      if (event.changedTouches.length !== 1) return;
      event.preventDefault();
      suppressClickUntil = Date.now() + 500;
      const touch = event.changedTouches[0];
      try {
        await relayClickAt(touch.clientX, touch.clientY);
      } catch {
        // Ignora erro visual; usuário pode tocar novamente.
      }
    }, { passive: false });

    imgEl.addEventListener("load", function() {
      applyDisplayScale();
    });

    void tick();
    pollTimer = setInterval(() => { void tick(); }, 2500);
  </script>
</body>
</html>`;
}

type ChallengeAssistRouterDeps = {
  getRuntimeClient: (sessionId: string) => InstaConnect | null;
  assertSessionOwner: (userId: string, sessionId: string) => Promise<boolean>;
};

function getSessionIdParam(req: Request): string {
  const raw = (req.params as { sessionId?: string }).sessionId;
  return typeof raw === "string" ? raw.trim() : "";
}

async function authorizeChallengeRequest(
  req: Request,
  res: Response,
  deps: ChallengeAssistRouterDeps,
): Promise<{ client: InstaConnect } | null> {
  const token = readAccessToken(req);
  const user = verifyAccessToken(token);
  if (!user) {
    res.status(401).json({ ok: false, error: "Token de acesso ausente ou inválido." });
    return null;
  }

  const sessionId = getSessionIdParam(req);
  if (!sessionId) {
    res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
    return null;
  }

  if (!(await deps.assertSessionOwner(user.id, sessionId))) {
    res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
    return null;
  }

  const client = deps.getRuntimeClient(sessionId);
  if (!client) {
    res.status(404).json({ ok: false, error: "Instância do Instagram não está ativa para esta sessão." });
    return null;
  }

  req.authUser = user;
  return { client };
}

export function createChallengeAssistRouter(deps: ChallengeAssistRouterDeps): Router {
  const router = Router({ mergeParams: true });
  const basePath = (sessionId: string) => `/insta/sessions/${encodeURIComponent(sessionId)}/challenge`;

  router.get("/", async (req, res) => {
    const token = readAccessToken(req);
    if (!token) {
      res.status(401).send("Token de acesso ausente. Abra esta página a partir do app Insta Connect.");
      return;
    }
    const authorized = await authorizeChallengeRequest(req, res, deps);
    if (!authorized) return;
    const sessionId = getSessionIdParam(req);
    res
      .status(200)
      .type("html")
      .set("cache-control", "no-store")
      .send(challengeAssistHtml(sessionId, basePath(sessionId), token));
  });

  router.get("/status", async (req, res) => {
    const authorized = await authorizeChallengeRequest(req, res, deps);
    if (!authorized) return;
    const sessionId = getSessionIdParam(req);
    try {
      const status = await authorized.client.getSessionStatus();
      res.json({
        ok: true,
        sessionId,
        ...status,
        manualInteractionRequired:
          status.challengeRequired &&
          status.challengeType !== undefined &&
          authorized.client.isManualInteractionChallengeType(status.challengeType),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/screenshot.json", async (req, res) => {
    const authorized = await authorizeChallengeRequest(req, res, deps);
    if (!authorized) return;
    const sessionId = getSessionIdParam(req);
    try {
      const shot = await authorized.client.getChallengeScreenshot();
      res.json({ ok: true, sessionId, ...shot });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/screenshot", async (req, res) => {
    const authorized = await authorizeChallengeRequest(req, res, deps);
    if (!authorized) return;
    const sessionId = getSessionIdParam(req);
    try {
      const shot = await authorized.client.getChallengeScreenshot();
      const buffer = Buffer.from(shot.base64, "base64");
      res
        .status(200)
        .type(shot.mimeType)
        .set({
          "cache-control": "no-store",
          "x-viewport-width": String(shot.width),
          "x-viewport-height": String(shot.height),
          "x-page-url": shot.url,
        })
        .send(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.post("/click", async (req, res) => {
    const authorized = await authorizeChallengeRequest(req, res, deps);
    if (!authorized) return;
    const sessionId = getSessionIdParam(req);
    try {
      const x = Number(req.body?.x);
      const y = Number(req.body?.y);
      const result = await authorized.client.relayChallengeClick(x, y);
      res.json({ ok: true, sessionId, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

  return router;
}

export function createChallengeAssistApiRouter(
  deps: ChallengeAssistRouterDeps & {
    onChallengeResolved: (
      userId: string,
      sessionId: string,
      username: string | undefined,
      result: Awaited<ReturnType<InstaConnect["waitForChallengeResolved"]>>,
      req: Request,
    ) => Promise<Record<string, unknown>>;
  },
): Router {
  const router = Router({ mergeParams: true });

  router.post("/wait-for-challenge-resolved", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      const sessionId = getSessionIdParam(req);
      const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : undefined;
      const timeoutMs =
        typeof req.body?.timeoutMs === "number" && Number.isFinite(req.body.timeoutMs)
          ? Math.max(5_000, Math.min(300_000, Math.round(req.body.timeoutMs)))
          : 120_000;

      if (!userId) {
        res.status(401).json({ ok: false, error: "Unauthorized." });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ ok: false, error: "sessionId é obrigatório." });
        return;
      }
      if (!(await deps.assertSessionOwner(userId, sessionId))) {
        res.status(404).json({ ok: false, error: "Sessão não encontrada para este usuário." });
        return;
      }

      const client = deps.getRuntimeClient(sessionId);
      if (!client) {
        res.status(404).json({ ok: false, error: "Instância do Instagram não está ativa para esta sessão." });
        return;
      }

      const result = await client.waitForChallengeResolved(timeoutMs);
      const payload = await deps.onChallengeResolved(userId, sessionId, username, result, req);
      res.json({ ok: true, activeSessionId: sessionId, ...payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

  return router;
}
