import { afterEach, describe, expect, it } from "vitest";

import {
  getPublicApiBaseUrl,
  getPublicEnv,
  PublicEnvError,
} from "./public";

const originalApi = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalMap = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

afterEach(() => {
  if (originalApi === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalApi;
  }

  if (originalMap === undefined) {
    delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  } else {
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = originalMap;
  }

  delete process.env.ACCESS_TOKEN_SECRET;
  delete process.env.MONGODB_URI;
});

describe("getPublicEnv", () => {
  it("allows a missing API base URL so the web build does not need backend secrets", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;

    expect(getPublicApiBaseUrl()).toBeUndefined();
    expect(getPublicEnv().mapStyleUrl).toBeUndefined();
  });

  it("strips a trailing slash from a valid API origin", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/";
    expect(getPublicApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("rejects an invalid public URL without treating it as optional", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "not-a-url";
    expect(() => getPublicApiBaseUrl()).toThrow(PublicEnvError);
    expect(() => getPublicApiBaseUrl()).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("does not read backend secret names from the public env helper", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    process.env.ACCESS_TOKEN_SECRET = "should-never-be-read-by-web";
    process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net";

    const source = getPublicEnv.toString();
    expect(source).not.toContain("ACCESS_TOKEN_SECRET");
    expect(source).not.toContain("MONGODB_URI");
    expect(getPublicEnv()).toEqual({
      apiBaseUrl: "http://localhost:4000",
      mapStyleUrl: undefined,
    });
  });
});
