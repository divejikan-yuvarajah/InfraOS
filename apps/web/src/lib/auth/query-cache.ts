type PrivateQueryCache = {
  clear: () => void;
};

let registered: PrivateQueryCache | null = null;

/** QueryProvider registers the app cache. Logout drops it so the next user cannot see it. */
export function registerPrivateQueryCache(cache: PrivateQueryCache): () => void {
  registered = cache;
  return () => {
    if (registered === cache) registered = null;
  };
}

export function clearPrivateQueryCache(): void {
  registered?.clear();
}
