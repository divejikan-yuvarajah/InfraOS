export type VerificationMessage = {
  to: string;
  token: string;
  link: string;
};

export type VerificationEmailSender = {
  mode: "memory" | "unavailable";
  send(message: VerificationMessage): Promise<void>;
  captured(): readonly VerificationMessage[];
};

export function createMemoryVerificationSender(): VerificationEmailSender {
  const box: VerificationMessage[] = [];
  return {
    mode: "memory",
    async send(message) {
      box.push({ to: message.to, token: message.token, link: message.link });
    },
    captured() {
      return box;
    },
  };
}

/** Production has no approved mail provider. Issuance must not pretend to send. */
export function createUnavailableVerificationSender(): VerificationEmailSender {
  return {
    mode: "unavailable",
    async send() {
      throw new Error("delivery-unavailable");
    },
    captured() {
      return [];
    },
  };
}

export function createVerificationSender(nodeEnv: string): VerificationEmailSender {
  if (nodeEnv === "production") {
    return createUnavailableVerificationSender();
  }
  return createMemoryVerificationSender();
}

export function verificationLink(allowlistedOrigin: string, token: string): string {
  const base = new URL(allowlistedOrigin);
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !local) {
    throw new Error("verification origin must be https");
  }
  const url = new URL("/verify-email", base.origin);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
