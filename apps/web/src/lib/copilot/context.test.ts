import { describe, expect, it } from "vitest";

import { deriveCopilotContext } from "./context";

describe("deriveCopilotContext", () => {
  const oid = "64b7f1c2a3d4e5f60718293a";

  it("extracts typed page context with validated 24-hex ObjectIds", () => {
    expect(deriveCopilotContext(`/projects/${oid}/overview`)).toEqual({
      type: "PROJECT",
      recordId: oid,
      projectIdHint: oid,
      route: `/projects/${oid}/overview`,
    });

    expect(deriveCopilotContext(`/projects/${oid}/risk?tab=factors`)).toEqual({
      type: "RISK",
      recordId: oid,
      projectIdHint: oid,
      route: `/projects/${oid}/risk`,
    });

    expect(deriveCopilotContext(`/inspections/${oid}/report`)).toEqual({
      type: "INSPECTION",
      recordId: oid,
      route: `/inspections/${oid}/report`,
    });

    expect(deriveCopilotContext(`/documents/${oid}`)).toEqual({
      type: "DOCUMENT",
      recordId: oid,
      route: `/documents/${oid}`,
    });

    expect(deriveCopilotContext(`/roadsync/conflicts/${oid}/advisor`)).toEqual({
      type: "CONFLICT",
      recordId: oid,
      route: `/roadsync/conflicts/${oid}/advisor`,
    });
  });

  it("ignores non-ObjectId path segments and handles workspace pages safely", () => {
    expect(deriveCopilotContext("/projects/new")).toEqual({
      type: "PROJECT",
      route: "/projects/new",
    });

    expect(deriveCopilotContext("/documents/processing")).toEqual({
      type: "DOCUMENT",
      route: "/documents/processing",
    });

    expect(deriveCopilotContext("/dashboard")).toEqual({
      type: "DASHBOARD",
      route: "/dashboard",
    });

    expect(deriveCopilotContext("/settings/ai")).toEqual({
      type: "OTHER",
      route: "/settings/ai",
    });
  });
});

