let currentTime = (): Date => new Date();

export function authNow(): Date {
  return currentTime();
}

/** Test-only clock. Production always uses the real clock. */
export function setAuthNowForTests(next: () => Date): void {
  currentTime = next;
}

export function resetAuthNowForTests(): void {
  currentTime = () => new Date();
}
