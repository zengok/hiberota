import { useCallback, useEffect, useMemo, useState } from "react";

const FAVORITES_KEY = "hibe-rota:favorites:v1";
const FAVORITES_EVENT = "hibe-rota:favorites-changed";

function readFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeFavorites(ids) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(() => readFavorites());

  useEffect(() => {
    const sync = () => setFavoriteIds(readFavorites());
    window.addEventListener("storage", sync);
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FAVORITES_EVENT, sync);
    };
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = useCallback((callId) => {
    if (!callId) return;
    const current = readFavorites();
    const next = current.includes(callId) ? current.filter((id) => id !== callId) : [...current, callId];
    writeFavorites(next);
  }, []);

  return {
    favoriteIds,
    isFavorite: useCallback((callId) => favoriteSet.has(callId), [favoriteSet]),
    toggleFavorite,
  };
}
