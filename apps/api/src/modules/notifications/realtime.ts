import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import { assertAuthSecretsReady, verifyAccessToken } from "../identity/auth/jwt.js";
import { User } from "../identity/models/user.model.js";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";

let io: SocketIOServer | null = null;

function extractBearer(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

export function initRealtime(httpServer: HttpServer): SocketIOServer | null {
  if (process.env.NODE_ENV === "test") return null;
  if (io) return io;

  const origins = env.FRONTEND_ORIGIN.split(",").map((s: string) => s.trim()).filter(Boolean);
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: origins.length > 0 ? origins : true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        extractBearer(socket.handshake.auth?.token) ??
        extractBearer(socket.handshake.headers?.authorization);
      if (!token) {
        next(new Error("AUTH_REQUIRED"));
        return;
      }
      assertAuthSecretsReady();
      const claims = await verifyAccessToken(token);
      const user = await User.findById(claims.sub).select("status emailVerified credentialEpoch").lean();
      if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || (user.credentialEpoch ?? 0) !== claims.credentialEpoch) {
        next(new Error("AUTH_REQUIRED"));
        return;
      }
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error("AUTH_REQUIRED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = typeof socket.data.userId === "string" ? socket.data.userId : null;
    if (userId) {
      void socket.join(`user:${userId}`);
    }
  });

  logger.info("Socket.IO realtime server initialized");
  return io;
}

export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io || userIds.length === 0) return;
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  const current = io;
  io = null;
  await new Promise<void>((resolve) => {
    current.close(() => resolve());
  });
}
