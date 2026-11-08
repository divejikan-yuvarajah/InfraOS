import { createHash, createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

export type StubCall = { path: string; method: string; headers: http.IncomingHttpHeaders; raw: string; json: Record<string, unknown> | null; signatureOk: boolean };
export type StubReply = { status?: number; body: unknown };
export type StubHandler = (call: StubCall) => StubReply | Promise<StubReply>;

/** Local stand-in for the FastAPI service. Verifies the HMAC signature exactly as the real service does. No real provider is ever called. */
export async function startAiStub(secret: string) {
  const calls: StubCall[] = [];
  const handlers = new Map<string, StubHandler>();
  const server = http.createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", async () => {
      const raw = Buffer.concat(parts).toString("utf8");
      const path = (req.url ?? "").split("?")[0]!;
      const multipart = (req.headers["content-type"] ?? "").startsWith("multipart/form-data");
      let json: Record<string, unknown> | null = null;
      let hashed = raw;
      if (multipart) {
        const m = /name="metadata"\r\n\r\n([\s\S]*?)\r\n--/.exec(raw);
        hashed = m?.[1] ?? "";
        try { json = JSON.parse(hashed) as Record<string, unknown>; } catch { json = null; }
      } else if (raw) { try { json = JSON.parse(raw) as Record<string, unknown>; } catch { json = null; } }
      const ts = String(req.headers["x-infraos-timestamp"] ?? "");
      const expected = createHmac("sha256", secret).update(`${req.method}\n${path}\n${ts}\n${createHash("sha256").update(hashed).digest("hex")}`).digest("hex");
      const call: StubCall = { path, method: req.method ?? "GET", headers: req.headers, raw, json, signatureOk: req.headers["x-infraos-signature"] === expected };
      calls.push(call);
      const h = handlers.get(path);
      let reply: StubReply = { status: 404, body: { code: "NOT_FOUND", message: "x", retryable: false, requestId: "stub" } };
      if (path === "/health") reply = { body: { status: "ok" } };
      else if (!call.signatureOk) reply = { status: 401, body: { code: "UNAUTHORIZED", message: "Unauthorized.", retryable: false, requestId: "stub" } };
      else if (h) reply = await h(call);
      res.writeHead(reply.status ?? 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    on: (path: string, h: StubHandler) => { handlers.set(path, h); },
    reset: () => { calls.length = 0; handlers.clear(); },
    close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections?.(); }),
  };
}

export const svcError = (code: string, status: number, retryable: boolean): StubReply => ({ status, body: { code, message: "x", retryable, requestId: "stub" } });

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** A valid extract-chunk response for the metadata the caller sent. */
export function extractReply(call: StubCall, chunkCount = 3): StubReply {
  const meta = call.json as { documentId: string; versionNo: number; fileSha256: string };
  const chunks = Array.from({ length: chunkCount }, (_, i) => {
    const text = `Clause ${i + 1}: the Contractor shall complete the works. Synthetic content ${i}.`;
    return { chunkId: `${meta.documentId}:${meta.versionNo}:${i}`, chunkIndex: i, text, pageStart: null, pageEnd: null, section: i === 0 ? "1. Definitions" : null, contentHash: sha(text), charCount: text.length, tokenEstimate: Math.ceil(text.length / 4) };
  });
  return { body: { fileSha256: meta.fileSha256, pipelineVersion: "p1", pageCount: null, pages: [{ page: null, charCount: 400 }], chunks, stats: { pages: 0, chars: 400, chunks: chunkCount, duplicatesDropped: 0, truncated: false, scripts: { si: 0, ta: 0, latin: 300 }, dominantScripts: ["latin"] }, warnings: [] } };
}
export function indexReply(call: StubCall): StubReply {
  const n = ((call.json?.chunks as unknown[]) ?? []).length;
  return { body: { embedded: n, skipped: 0, tokens: 111, model: "BAAI/bge-m3", dimension: 1024, collection: "infraos_chunks__baai-bge-m3__1024" } };
}
