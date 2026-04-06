import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Card3D from './Card3D';
import './CardMini3D.css';

const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

function CardMini3D({ card, size = 'medium', onClick }) {
  const [hovered, setHovered] = useState(false);
  const rarity = card?.rarity || 'common';
  const glowColor = card?.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';

  const sizes = {
    tiny: { width: 65, height: 91 },
    small: { width: 120, height: 168 },
    medium: { width: 170, height: 238 },
    large: { width: 240, height: 336 },
  };
  const dim = sizes[size] || sizes.medium;

  // Camera distance based on size
  const camZ = size === 'tiny' ? 4.5 : size === 'small' ? 4 : 3.5;

  return (
    <div
      className={`card-mini-3d card-mini-3d--${size} rarity-${rarity}`}
      style={{
        width: dim.width,
        height: dim.height,
        '--glow-color': glowColor,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas
        camera={{ position: [0, 0, camZ], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 4]} intensity={1} />
        <directionalLight position={[-2, -1, 2]} intensity={0.3} />
        <Suspense fallback={null}>
          <Card3D
            card={card}
            floatAnimation={hovered}
            autoRotate={false}
            scale={size === 'tiny' ? 0.7 : size === 'small' ? 0.85 : 1}
          />
        </Suspense>
      </Canvas>

      {/* Overlay info — card name and rarity (shown on hover or always for large) */}
      {size !== 'tiny' && (
        <div className="card-mini-3d__info">
          <span className="card-mini-3d__name">{card?.name || 'Card'}</span>
          {card?.creator_display_name && size !== 'small' && (
            <span className="card-mini-3d__creator">{card.creator_display_name}</span>
          )}
          <span className={`card-mini-3d__rarity rarity-text--${rarity}`}>
            {(rarity).toUpperCase().replace('-', ' ')}
          </span>
        </div>
      )}

      {/* Stack count badge */}
      {card?.stackCount > 1 && (
        <div className="card-mini-3d__stack">x{card.stackCount}</div>
      )}
    </div>
  );
}

export default CardMini3D;
