import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../modules/auth/auth.middleware";

export type AutoFollowJobLike = {
  id: string;
  userId: string;
  sessionId: string;
  type: "suggested" | "followers";
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: unknown | null;
};

function serializeAutofollowJob(job: AutoFollowJobLike) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    sessionId: job.sessionId,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    result: job.result,
  };
}

export type InstaRealtimeHandles = {
  emitFollowScheduleTouch(userId: string, sessionId: string, reason: "executed" | "mutated"): void;
  emitAutofollowJobToSubscribers(job: AutoFollowJobLike): void;
};

export function initInstaRealtime(
  httpServer: HttpServer,
  deps: { getJob: (jobId: string) => AutoFollowJobLike | undefined },
): InstaRealtimeHandles {
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as Record<string, unknown> | undefined;
    const tokenFromAuth = typeof auth?.token === "string" ? auth.token : undefined;
    const q = socket.handshake.query as Record<string, unknown>;
    const tokenFromQuery = typeof q?.token === "string" ? String(q.token) : undefined;
    const user = verifyAccessToken(tokenFromAuth ?? tokenFromQuery ?? null);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    (socket.data as { userId: string }).userId = user.id;
    void socket.join(`user:${user.id}`);
    next();
  });

  io.on("connection", (socket: Socket) => {
    socket.on("autofollow:subscribe", (jobIdUnknown: unknown) => {
      const jobId = typeof jobIdUnknown === "string" ? jobIdUnknown.trim() : "";
      if (!jobId) {
        return;
      }
      const job = deps.getJob(jobId);
      const userId = (socket.data as { userId: string }).userId;
      if (!job || job.userId !== userId) {
        socket.emit("autofollow:subscribe_error", { jobId, error: "not_found" });
        return;
      }
      const payload = { ok: true as const, job: serializeAutofollowJob(job) };
      if (job.status === "completed" || job.status === "failed") {
        socket.emit("autofollow:job", payload);
        return;
      }
      void socket.join(`autofollowJob:${jobId}`);
    });
  });

  return {
    emitFollowScheduleTouch(userId, sessionId, reason) {
      io.to(`user:${userId}`).emit("followSchedule:touch", { sessionId, reason });
    },
    emitAutofollowJobToSubscribers(job) {
      const payload = { ok: true as const, job: serializeAutofollowJob(job) };
      io.to(`autofollowJob:${job.id}`).emit("autofollow:job", payload);
    },
  };
}
