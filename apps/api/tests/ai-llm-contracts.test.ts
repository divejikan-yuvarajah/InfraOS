import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { answerRequest, answerResponse, extractRequest, extractResponse, mapRequest, mapResponse, reduceRequest, reduceResponse } from "../src/modules/ai/ai.contracts.js";

const fixture = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, "../../ai-service/tests/fixtures", `${name}.json`), "utf8"));

describe("LLM endpoint contracts: the JSON fixtures pydantic validates must pass the zod mirrors", () => {
  it.each([
    ["llm-answer.request", answerRequest], ["llm-answer.response", answerResponse], ["llm-map.request", mapRequest], ["llm-map.response", mapResponse],
    ["llm-reduce.request", reduceRequest], ["llm-reduce.response", reduceResponse], ["llm-extract.request", extractRequest], ["llm-extract.response", extractResponse],
  ] as const)("%s", (name, schema) => { expect(schema.safeParse(fixture(name)).success).toBe(true); });

  it("rejects out-of-range requests and unknown statuses", () => {
    const req = fixture("llm-answer.request") as Record<string, unknown>;
    expect(answerRequest.safeParse({ ...req, maxOutputTokens: 10 }).success).toBe(false);
    expect(answerRequest.safeParse({ ...req, sources: [] }).success).toBe(false);
    const res = fixture("llm-answer.response") as { output: Record<string, unknown> };
    expect(answerResponse.safeParse({ ...res, output: { ...res.output, status: "MAYBE" } }).success).toBe(false);
  });
});
