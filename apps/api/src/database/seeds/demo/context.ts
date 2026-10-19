import type { Types } from "mongoose";

import type { DemoProjectCode } from "./catalog.js";
import type { DemoUserKey } from "../helpers/fixture-users.js";

export type DemoContext = {
  agencies: Map<string, Types.ObjectId>;
  users: Map<DemoUserKey, Types.ObjectId>;
  roles: Map<string, Types.ObjectId>;
  contractors: Map<string, Types.ObjectId>;
  projects: Map<DemoProjectCode, Types.ObjectId>;
  assets: Map<string, Types.ObjectId>;
};

export function ctxId(map: Map<string, Types.ObjectId>, code: string): Types.ObjectId {
  const value = map.get(code);
  if (!value) {
    throw new Error(`Demo context missing id for ${code}`);
  }
  return value;
}
