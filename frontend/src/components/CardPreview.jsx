import './CardPreview.css';

const RARITY_OUTLINE_COLORS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

function CardPreview({ card, size = 'medium', onClick }) {
  const outlineColor = card.outline_color || RARITY_OUTLINE_COLORS[card.rarity] || '#a0a0a0';
  const bgColor = card.background_color || '#1a1a2e';
  const txtColor = card.text_color || '#ffffff';
  const effect = card.effect || 'none';
  const effectColor = card.effect_color || '#ffffff';
  const intensity = card.effect_intensity ?? 50;

  const streamerName = card.creator_display_name || card.creator_name || null;

  const sizeClass = `card-preview--${size}`;

  return (
    <div
      className={`card-preview ${sizeClass} effect-${effect} rarity-${card.rarity}`}
      style={{
        '--outline-color': outlineColor,
        '--bg-color': bgColor,
        '--text-color': txtColor,
        '--effect-color': effectColor,
        '--effect-intensity': intensity / 100,
      }}
      onClick={onClick}
    >
      {/* Outline border */}
      <div className="card-preview__border">
        {/* Streamer tag — top-left */}
        {streamerName && (
          <div className="card-preview__streamer">
            <svg className="card-preview__twitch-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            <span>{streamerName}</span>
          </div>
        )}

        {/* Card content */}
        <div className="card-preview__inner">
          {/* Image area */}
          <div className="card-preview__image">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} />
            ) : (
              <div className="card-preview__placeholder">🎴</div>
            )}
          </div>

          {/* Card info */}
          <div className="card-preview__info">
            <h4 className="card-preview__name">{card.name || 'Card Name'}</h4>
            {card.description && (
              <p className="card-preview__desc">{card.description}</p>
            )}
          </div>

          {/* Rarity badge */}
          <div className="card-preview__rarity">
            {(card.rarity || 'common').toUpperCase().replace('-', ' ')}
          </div>
        </div>

        {/* Effect overlay — rendered ABOVE card content */}
        {effect !== 'none' && (
          <div className={`card-preview__effect card-preview__${effect === 'holographic' ? 'holo' : effect === 'shining' ? 'shine' : effect}`} />
        )}
      </div>
    </div>
  );
}

export default CardPreview;
