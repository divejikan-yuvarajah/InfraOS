import { SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import { env } from "../src/config/env.js";
import { resetAuthNowForTests, setAuthNowForTests } from "../src/modules/identity/auth/auth.clock.js";
import { signAccessToken, verifyAccessToken } from "../src/modules/identity/auth/jwt.js";

const ACCESS = "access-secret-step39-0123456789abcdef";
const REFRESH = "refresh-secret-step39-0123456789abcdef";

describe("access token verification", () => {
  afterEach(() => {
    resetAuthNowForTests();
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
  });

  it("accepts an HS256 access token and rejects tampering, none, and the wrong audience", async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    const { token } = await signAccessToken("user-1");
    await expect(verifyAccessToken(token)).resolves.toMatchObject({ sub: "user-1" });

    const tampered = `${token.slice(0, -2)}aa`;
    await expect(verifyAccessToken(tampered)).rejects.toThrow();

    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    const nonePayload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        typ: "access",
        iss: "infraos-api",
        aud: "infraos-web",
      }),
    ).toString("base64url");
    await expect(verifyAccessToken(`${noneHeader}.${nonePayload}.`)).rejects.toThrow();

    const wrongAudience = await new SignJWT({ typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("elsewhere")
      .setSubject("user-1")
      .setJti("jti-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    await expect(verifyAccessToken(wrongAudience)).rejects.toThrow();

    const wrongType = await new SignJWT({ typ: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject("user-1")
      .setJti("jti-2")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    await expect(verifyAccessToken(wrongType)).rejects.toThrow();

    setAuthNowForTests(() => new Date(Date.now() + 20 * 60 * 1000));
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("fails closed when the access and refresh secrets are missing or identical", async () => {
    env.ACCESS_TOKEN_SECRET = undefined;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await expect(signAccessToken("user-1")).rejects.toThrow();
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = ACCESS;
    await expect(signAccessToken("user-1")).rejects.toThrow();
  });
});
