export function readResetTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const value = new URLSearchParams(raw).get("token");
  return value && value.length > 0 ? value : null;
}

/** Hash wins. An empty hash keeps a token already held in memory. */
export function retainResetToken(fromHash: string | null, held: string | null): string | null {
  return fromHash ?? held;
}
