"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { getAuthEpoch, getMemoryAccessToken, subscribeAuth } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

type RealtimeNoticePayload = {
  type?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  title?: string;
  actionUrl?: string | null;
};

export function RealtimeProvider() {
  const qc = useQueryClient();
  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const token = useSyncExternalStore(subscribeAuth, getMemoryAccessToken, () => null);

  useEffect(() => {
    if (!token) return;
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl) return;

    let socket: Socket | null = null;
    try {
      socket = io(baseUrl.replace(/\/$/, ""), {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionDelay: 3000,
      });

      socket.on("notification:new", (payload: RealtimeNoticePayload) => {
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        void qc.invalidateQueries({ queryKey: ["projects", "notices-popover"] });
        void qc.invalidateQueries({ queryKey: ["alerts"] });

        const title = payload?.title || "New notification";
        if (payload?.severity === "CRITICAL") {
          toast.error(title);
        } else if (payload?.severity === "WARNING") {
          toast.warning(title);
        } else {
          toast.info(title);
        }
      });
    } catch {
      // Fallback polling below handles environments without WebSocket connectivity
    }

    const fallbackPoll = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    }, 60_000);

    return () => {
      window.clearInterval(fallbackPoll);
      socket?.disconnect();
    };
  }, [token, epoch, qc]);

  return null;
}
