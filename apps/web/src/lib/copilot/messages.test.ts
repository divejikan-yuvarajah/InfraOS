import { describe, expect, it } from "vitest";

import { aiAdminKeyPaths } from "@/lib/ai-admin/messages";

import { COPILOT_EN } from "./messages-en";
import { COPILOT_SI } from "./messages-si";
import { COPILOT_TA } from "./messages-ta";

describe("copilot dictionary key parity", () => {
  it("matches every key across en, si, and ta", () => {
    const enKeys = aiAdminKeyPaths(COPILOT_EN).sort();
    const siKeys = aiAdminKeyPaths(COPILOT_SI).sort();
    const taKeys = aiAdminKeyPaths(COPILOT_TA).sort();
    expect(siKeys).toEqual(enKeys);
    expect(taKeys).toEqual(enKeys);
  });
});

