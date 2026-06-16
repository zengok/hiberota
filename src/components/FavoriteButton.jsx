import { Heart } from "lucide-react";
import { useFavorites } from "../hooks/useFavorites.js";

export function FavoriteButton({ callId, className = "", label = "Favorilere Ekle" }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(callId);

  return (
    <button
      type="button"
      className={`favoriteButton ${active ? "active" : ""} ${className}`.trim()}
      aria-pressed={active}
      aria-label={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      title={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(callId);
      }}
    >
      <Heart size={18} fill={active ? "currentColor" : "none"} />
      <span>{active ? "Favorilerde" : label}</span>
    </button>
  );
}
