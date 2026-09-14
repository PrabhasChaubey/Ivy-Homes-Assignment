// lib/favourites.ts
// The documented /v1/favourites API doesn't exist server-side — confirmed
// 404 on every method and plausible path variant (see findings:
// missing_endpoint). Saved listings are implemented client-side instead,
// keyed by the logged-in user's email, so "per user, persists after
// reload and re-login" still holds using localStorage as the store.

function storageKey(email: string) {
  return `ivy_favourites_${email}`;
}

export function getFavouriteIds(email: string | null): string[] {
  if (!email || typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey(email));
  return raw ? JSON.parse(raw) : [];
}

export function isFavourite(email: string | null, listingId: string): boolean {
  return getFavouriteIds(email).includes(listingId);
}

export function addFavouriteLocal(email: string, listingId: string) {
  const ids = new Set(getFavouriteIds(email));
  ids.add(listingId);
  window.localStorage.setItem(storageKey(email), JSON.stringify([...ids]));
}

export function removeFavouriteLocal(email: string, listingId: string) {
  const ids = new Set(getFavouriteIds(email));
  ids.delete(listingId);
  window.localStorage.setItem(storageKey(email), JSON.stringify([...ids]));
}
