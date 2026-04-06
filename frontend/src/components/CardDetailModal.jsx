import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Card3D from './Card3D';
import './CardDetailModal.css';

const RARITY_LABELS = {
  common: 'Commune',
  uncommon: 'Peu commune',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
  'ultra-legendary': 'Ultra Legendaire',
};

function CardDetailModal({ card, onClose }) {
  if (!card) return null;

  const obtainedDate = card.obtained_at
    ? new Date(card.obtained_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="card-detail-close" onClick={onClose}>&times;</button>

        <div className="card-detail-content">
          {/* 3D Card preview — interactive, can rotate */}
          <div className="card-detail-preview card-detail-3d">
            <Canvas
              camera={{ position: [0, 0, 5], fov: 40 }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: 'transparent' }}
            >
              <ambientLight intensity={0.6} />
              <directionalLight position={[3, 3, 5]} intensity={1.2} />
              <directionalLight position={[-2, -1, 3]} intensity={0.4} />
              <Suspense fallback={null}>
                <Card3D
                  card={card}
                  floatAnimation={true}
                  autoRotate={false}
                  scale={0.85}
                />
              </Suspense>
              <OrbitControls
                enableZoom={false}
                enablePan={false}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI * 3 / 4}
              />
            </Canvas>
            <span className="card-detail-3d-hint">Glissez pour tourner la carte</span>
          </div>

          {/* Card info */}
          <div className="card-detail-info">
            <h2 className="card-detail-name">{card.name || 'Sans nom'}</h2>

            <span className={`card-detail-rarity rarity-text--${card.rarity}`}>
              {RARITY_LABELS[card.rarity] || card.rarity}
            </span>

            {card.description && (
              <p className="card-detail-desc">{card.description}</p>
            )}

            <div className="card-detail-meta">
              {card.creator_display_name && (
                <div className="meta-row">
                  <span className="meta-label">Createur</span>
                  <span className="meta-value">
                    {card.creator_image && (
                      <img src={card.creator_image} alt="" className="meta-avatar" />
                    )}
                    {card.creator_display_name}
                  </span>
                </div>
              )}

              {card.booster_pack_name && (
                <div className="meta-row">
                  <span className="meta-label">Booster</span>
                  <span className="meta-value">{card.booster_pack_name}</span>
                </div>
              )}

              {obtainedDate && (
                <div className="meta-row">
                  <span className="meta-label">Obtenue le</span>
                  <span className="meta-value">{obtainedDate}</span>
                </div>
              )}

              {card.stackCount > 1 && (
                <div className="meta-row">
                  <span className="meta-label">Exemplaires</span>
                  <span className="meta-value meta-value--highlight">x{card.stackCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardDetailModal;
