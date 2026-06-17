import type { Server, Socket } from "socket.io";
import type { InstaConnect } from "insta-connect-delsuc";

const CHALLENGE_PUSH_INTERVAL_MS = 1_000;

export type ChallengeAssistRealtimeDeps = {
  getRuntimeClient: (sessionId: string) => InstaConnect | null;
  assertSessionOwner: (userId: string, sessionId: string) => Promise<boolean>;
};

type StreamState = {
  subscribers: number;
  timer: ReturnType<typeof setInterval> | null;
  pushing: boolean;
};

type SocketChallengeData = {
  userId: string;
  challengeSessions?: Set<string>;
};

function challengeRoom(sessionId: string): string {
  return `challenge:${sessionId}`;
}

function readSessionId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getChallengeSessions(socket: Socket): Set<string> {
  const data = socket.data as SocketChallengeData;
  if (!data.challengeSessions) {
    data.challengeSessions = new Set();
  }
  return data.challengeSessions;
}

async function resolveChallengeClient(
  userId: string,
  sessionId: string,
  deps: ChallengeAssistRealtimeDeps,
): Promise<InstaConnect | null> {
  if (!sessionId) {
    return null;
  }
  if (!(await deps.assertSessionOwner(userId, sessionId))) {
    return null;
  }
  return deps.getRuntimeClient(sessionId);
}

async function pushChallengeUpdate(
  io: Server,
  sessionId: string,
  client: InstaConnect,
  streams: Map<string, StreamState>,
): Promise<void> {
  const room = challengeRoom(sessionId);
  try {
    const status = await client.getSessionStatus();
    io.to(room).emit("challenge:status", {
      ok: true,
      sessionId,
      ...status,
      manualInteractionRequired:
        status.challengeRequired &&
        status.challengeType !== undefined &&
        client.isManualInteractionChallengeType(status.challengeType),
    });

    if (status.loggedIn) {
      io.to(room).emit("challenge:login-success", { sessionId });
      const state = streams.get(sessionId);
      if (state?.timer) {
        clearInterval(state.timer);
      }
      streams.delete(sessionId);
      return;
    }

    const shot = await client.getChallengeScreenshot();
    io.to(room).emit("challenge:screenshot", {
      ok: true,
      sessionId,
      ...shot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.to(room).emit("challenge:error", { sessionId, error: message });
  }
}

function addSubscriber(
  io: Server,
  sessionId: string,
  deps: ChallengeAssistRealtimeDeps,
  streams: Map<string, StreamState>,
): void {
  let state = streams.get(sessionId);
  if (!state) {
    state = { subscribers: 0, timer: null, pushing: false };
    streams.set(sessionId, state);
  }
  state.subscribers += 1;

  if (state.timer) {
    return;
  }

  const tick = async () => {
    const current = streams.get(sessionId);
    if (!current || current.pushing) {
      return;
    }
    const client = deps.getRuntimeClient(sessionId);
    if (!client) {
      if (current.timer) {
        clearInterval(current.timer);
      }
      streams.delete(sessionId);
      io.to(challengeRoom(sessionId)).emit("challenge:error", {
        sessionId,
        error: "Instância do Instagram não está ativa para esta sessão.",
      });
      return;
    }

    current.pushing = true;
    try {
      await pushChallengeUpdate(io, sessionId, client, streams);
    } finally {
      const after = streams.get(sessionId);
      if (after) {
        after.pushing = false;
      }
    }
  };

  void tick();
  state.timer = setInterval(() => {
    void tick();
  }, CHALLENGE_PUSH_INTERVAL_MS);
}

function removeSubscriber(sessionId: string, streams: Map<string, StreamState>): void {
  const state = streams.get(sessionId);
  if (!state) {
    return;
  }
  state.subscribers = Math.max(0, state.subscribers - 1);
  if (state.subscribers <= 0) {
    if (state.timer) {
      clearInterval(state.timer);
    }
    streams.delete(sessionId);
  }
}

export function registerChallengeAssistRealtime(io: Server, deps: ChallengeAssistRealtimeDeps): void {
  const streams = new Map<string, StreamState>();

  io.on("connection", (socket: Socket) => {
    socket.on("challenge:subscribe", async (payload: { sessionId?: string } | undefined) => {
      const sessionId = readSessionId(payload?.sessionId);
      const userId = (socket.data as SocketChallengeData).userId;
      const sessions = getChallengeSessions(socket);

      if (!sessionId) {
        socket.emit("challenge:error", { sessionId: "", error: "sessionId é obrigatório." });
        return;
      }

      if (sessions.has(sessionId)) {
        socket.emit("challenge:subscribed", { ok: true, sessionId });
        return;
      }

      const client = await resolveChallengeClient(userId, sessionId, deps);
      if (!client) {
        socket.emit("challenge:error", { sessionId, error: "Sessão indisponível ou não autorizada." });
        return;
      }

      try {
        await socket.join(challengeRoom(sessionId));
        sessions.add(sessionId);
        addSubscriber(io, sessionId, deps, streams);
        socket.emit("challenge:subscribed", { ok: true, sessionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        socket.emit("challenge:error", { sessionId, error: message });
      }
    });

    socket.on("challenge:unsubscribe", async (payload: { sessionId?: string } | undefined) => {
      const sessionId = readSessionId(payload?.sessionId);
      if (!sessionId) {
        return;
      }
      const sessions = getChallengeSessions(socket);
      if (!sessions.has(sessionId)) {
        return;
      }
      sessions.delete(sessionId);
      removeSubscriber(sessionId, streams);
      try {
        await socket.leave(challengeRoom(sessionId));
      } catch {
        /* noop */
      }
    });

    socket.on(
      "challenge:click",
      async (payload: { sessionId?: string; x?: unknown; y?: unknown } | undefined) => {
        const sessionId = readSessionId(payload?.sessionId);
        const userId = (socket.data as SocketChallengeData).userId;

        if (!sessionId) {
          socket.emit("challenge:error", { sessionId: "", error: "sessionId é obrigatório." });
          return;
        }

        if (!socket.rooms.has(challengeRoom(sessionId))) {
          socket.emit("challenge:error", { sessionId, error: "Assine challenge:subscribe antes de clicar." });
          return;
        }

        const x = Number(payload?.x);
        const y = Number(payload?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          socket.emit("challenge:error", { sessionId, error: "Coordenadas x/y inválidas." });
          return;
        }

        const client = await resolveChallengeClient(userId, sessionId, deps);
        if (!client) {
          socket.emit("challenge:error", { sessionId, error: "Sessão indisponível ou não autorizada." });
          return;
        }

        try {
          await client.relayChallengeClick(x, y);
          await pushChallengeUpdate(io, sessionId, client, streams);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          socket.emit("challenge:error", { sessionId, error: message });
        }
      },
    );

    socket.on("disconnect", () => {
      const sessions = getChallengeSessions(socket);
      for (const sessionId of sessions) {
        removeSubscriber(sessionId, streams);
      }
      sessions.clear();
    });
  });
}
