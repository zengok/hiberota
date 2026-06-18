import React from "react";

export function AdBanner({ type = "custom", size = "leaderboard", link = "#", image, text = "Reklam Alanı" }) {
  const containerClass = `adContainer ad-${size}`;
  
  if (type === "custom") {
    return (
      <div className={containerClass}>
        <a href={link} className="customAdLink" target="_blank" rel="noopener noreferrer">
          {image ? (
            <img src={image} alt="Reklam" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className="adPlaceholder">
              {text}
            </div>
          )}
        </a>
        <span className="adBadge">Sponsorlu</span>
      </div>
    );
  }

  // Placeholder for Google Adsense or other ad networks
  return (
    <div className={containerClass}>
      <div className="adPlaceholder">
        Google Adsense Alanı
      </div>
      <span className="adBadge">Sponsorlu</span>
    </div>
  );
}
