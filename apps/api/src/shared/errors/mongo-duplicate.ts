/**
 * Map Mongo duplicate key (E11000) to a field name for later API errors.
 * Never return the raw driver message to clients.
 */
export function mapMongoDuplicateField(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: number }).code !== 11000
  ) {
    return undefined;
  }

  const keyPattern = (error as { keyPattern?: Record<string, unknown> })
    .keyPattern;
  if (keyPattern) {
    const [field] = Object.keys(keyPattern);
    return field;
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("email")) return "email";
  if (message.includes("key")) return "key";
  if (message.includes("code")) return "code";
  return undefined;
}
