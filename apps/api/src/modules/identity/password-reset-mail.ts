export type PasswordResetMessage = {
  to: string;
  token: string;
  link: string;
};

export type PasswordResetEmailSender = {
  mode: "memory" | "unavailable";
  send(message: PasswordResetMessage): Promise<void>;
  captured(): readonly PasswordResetMessage[];
};

export function createMemoryPasswordResetSender(): PasswordResetEmailSender {
  const box: PasswordResetMessage[] = [];
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
export function createUnavailablePasswordResetSender(): PasswordResetEmailSender {
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

export function createPasswordResetSender(nodeEnv: string): PasswordResetEmailSender {
  if (nodeEnv === "production") {
    return createUnavailablePasswordResetSender();
  }
  return createMemoryPasswordResetSender();
}

export function passwordResetLink(allowlistedOrigin: string, token: string): string {
  const base = new URL(allowlistedOrigin);
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !local) {
    throw new Error("reset origin must be https");
  }
  const url = new URL("/reset-password", base.origin);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
