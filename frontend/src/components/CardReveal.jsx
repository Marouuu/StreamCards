import { useState, useEffect } from 'react';
import CardPreview from './CardPreview';
import './CardReveal.css';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

const RARITY_LABELS = {
  common: 'Commune',
  uncommon: 'Peu commune',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
  'ultra-legendary': 'Ultra Legendaire',
};

function CardReveal({ cards, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [revealed, setRevealed] = useState([]);
  const [showAll, setShowAll] = useState(false);

  // Sort cards by rarity (common first, reveal best last)
  const sortedCards = [...(cards || [])].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );

  useEffect(() => {
    if (sortedCards.length > 0 && currentIndex === -1) {
      // Start reveal after brief intro
      const timer = setTimeout(() => setCurrentIndex(0), 600);
      return () => clearTimeout(timer);
    }
  }, [sortedCards.length, currentIndex]);

  const handleRevealNext = () => {
    if (currentIndex < sortedCards.length) {
      setRevealed(prev => [...prev, currentIndex]);
      if (currentIndex + 1 >= sortedCards.length) {
        // All revealed, show summary after a moment
        setTimeout(() => setShowAll(true), 800);
      } else {
        setTimeout(() => setCurrentIndex(prev => prev + 1), 400);
      }
    }
  };

  const handleSkipAll = () => {
    setRevealed(sortedCards.map((_, i) => i));
    setShowAll(true);
  };

  const currentCard = sortedCards[currentIndex];
  const currentRarity = currentCard?.rarity || 'common';
  const isHighRarity = ['epic', 'legendary', 'ultra-legendary'].includes(currentRarity);

  if (showAll) {
    return (
      <div className="card-reveal-overlay" onClick={onClose}>
        <div className="card-reveal-summary" onClick={e => e.stopPropagation()}>
          <h2 className="reveal-summary-title">Vos nouvelles cartes !</h2>
          <div className="reveal-summary-grid">
            {sortedCards.map((card, i) => (
              <div key={i} className={`reveal-summary-card rarity-glow--${card.rarity}`}>
                <CardPreview card={card} size="medium" />
                <span className={`reveal-rarity-label rarity-text--${card.rarity}`}>
                  {RARITY_LABELS[card.rarity] || card.rarity}
                </span>
                {card.isNew && <span className="reveal-new-badge">NEW</span>}
              </div>
            ))}
          </div>
          <button className="reveal-close-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-reveal-overlay rarity-bg--${currentRarity}`}>
      <button className="reveal-skip-btn" onClick={handleSkipAll}>
        Tout reveler ({sortedCards.length - revealed.length} restante{sortedCards.length - revealed.length > 1 ? 's' : ''})
      </button>

      {currentIndex >= 0 && currentCard && (
        <div
          className={`card-reveal-stage ${revealed.includes(currentIndex) ? 'revealed' : ''}`}
          onClick={handleRevealNext}
        >
          {/* Card back (before reveal) */}
          {!revealed.includes(currentIndex) && (
            <div className={`card-reveal-back ${isHighRarity ? 'card-reveal-back--epic' : ''}`}>
              <div className="card-back-inner">
                <div className="card-back-pattern"></div>
                <span className="card-back-icon">?</span>
                <span className="card-back-hint">Cliquez pour reveler</span>
              </div>
            </div>
          )}

          {/* Card front (after reveal) */}
          {revealed.includes(currentIndex) && (
            <div className={`card-reveal-front rarity-burst--${currentRarity}`}>
              <div className="reveal-card-container">
                <CardPreview card={currentCard} size="large" />
              </div>
              <div className="reveal-card-info">
                <span className={`reveal-rarity-tag rarity-text--${currentRarity}`}>
                  {RARITY_LABELS[currentRarity]}
                </span>
                {currentCard.isNew && <span className="reveal-new-tag">NOUVELLE CARTE !</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress dots */}
      <div className="reveal-progress">
        {sortedCards.map((card, i) => (
          <div
            key={i}
            className={`reveal-dot ${i === currentIndex ? 'active' : ''} ${revealed.includes(i) ? 'done' : ''} rarity-dot--${card.rarity}`}
          />
        ))}
      </div>

      {currentIndex === -1 && (
        <div className="reveal-intro">
          <div className="reveal-intro-icon">&#128230;</div>
          <h2>Booster ouvert !</h2>
          <p>{sortedCards.length} carte{sortedCards.length > 1 ? 's' : ''} a decouvrir</p>
        </div>
      )}
    </div>
  );
}

export default CardReveal;
