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
        {/* Holographic shimmer overlay */}
        {effect === 'holographic' && <div className="card-preview__holo" />}

        {/* Shining rays */}
        {effect === 'shining' && <div className="card-preview__shine" />}

        {/* Shadow / fog effect */}
        {effect === 'shadow' && <div className="card-preview__shadow" />}

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
      </div>
    </div>
  );
}

export default CardPreview;
