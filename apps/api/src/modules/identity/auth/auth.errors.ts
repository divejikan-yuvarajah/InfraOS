export class AuthDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;

  constructor(message = "sign-in is temporarily unavailable") {
    super(message);
    this.name = "AuthDependencyError";
  }
}
