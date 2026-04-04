import { useState, useEffect, useMemo } from 'react';
import { api } from '../config/api';
import { getToken, setToken } from '../utils/auth';
import BoosterOpening from '../components/BoosterOpening';
import BoosterMini3D from '../components/BoosterMini3D';
import './Shop.css';

function Shop({ onBack, onUserUpdate }) {
  const [boosters, setBoosters] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [openingBooster, setOpeningBooster] = useState(null);
  const [openedCards, setOpenedCards] = useState([]);
  const [streamerFilter, setStreamerFilter] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await api.getCurrentUser();
        if (userData) setUser(userData);

        const token = getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/shop/boosters`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setBoosters(data.boosters || []);
        }
      } catch (error) {
        console.error('Error loading shop data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Get unique streamers for the filter
  const streamers = useMemo(() => {
    const map = new Map();
    for (const b of boosters) {
      const id = b.creator_id || b.creator_name;
      if (id && !map.has(id)) {
        map.set(id, {
          id,
          name: b.creator_display_name || b.creator_name || 'Unknown',
          image: b.creator_image,
        });
      }
    }
    return [...map.values()];
  }, [boosters]);

  // Filter boosters by streamer
  const filteredBoosters = useMemo(() => {
    if (streamerFilter === 'all') return boosters;
    return boosters.filter(b => (b.creator_id || b.creator_name) === streamerFilter);
  }, [boosters, streamerFilter]);

  const scrollCarousel = (direction) => {
    const carousel = document.querySelector('.boosters-grid');
    if (!carousel) return;
    const scrollAmount = 352; // 320px card + 32px gap
    carousel.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const handlePurchase = async (boosterId) => {
    if (purchasing) return;

    const booster = boosters.find(b => b.id === boosterId);
    if (!booster) return;

    if (user.coins < booster.price) {
      setMessage({ type: 'error', text: 'Pas assez de coins !' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setPurchasing(boosterId);
    setMessage({ type: '', text: '' });

    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/shop/boosters/${boosterId}/purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Réponse invalide du serveur');
      }

      if (response.ok) {
        if (data.newToken) setToken(data.newToken);

        const userData = await api.getCurrentUser();
        if (userData) {
          setUser(userData);
          if (onUserUpdate) onUserUpdate(userData);
        }

        setOpenedCards(data.cards || []);
        setOpeningBooster(booster);
      } else {
        const errorMessage = data.error || data.message || 'Erreur lors de l\'achat';
        setMessage({ type: 'error', text: errorMessage });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      console.error('Error purchasing booster:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur de connexion au serveur' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="shop-loading">
        <div className="loading-spinner"></div>
        <p>Chargement de la boutique...</p>
      </div>
    );
  }

  return (
    <>
      {openingBooster && (
        <BoosterOpening
          booster={openingBooster}
          cards={openedCards}
          onClose={() => {
            setOpeningBooster(null);
            setOpenedCards([]);
            setMessage({ type: 'success', text: `Achat réussi ! Vous avez obtenu ${openedCards.length} carte(s).` });
            setTimeout(() => setMessage({ type: '', text: '' }), 5000);
          }}
        />
      )}
      <div className="shop">
        <div className="shop-header">
          {onBack && (
            <button className="shop-back-btn" onClick={onBack}>←</button>
          )}
          <h1>Boutique</h1>
          <div></div>
        </div>

        {/* Streamer filter */}
        {streamers.length > 0 && (
          <div className="shop-filters">
            <button
              className={`streamer-filter-btn ${streamerFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStreamerFilter('all')}
            >
              Tous les streamers
            </button>
            {streamers.map(s => (
              <button
                key={s.id}
                className={`streamer-filter-btn ${streamerFilter === s.id ? 'active' : ''}`}
                onClick={() => setStreamerFilter(s.id)}
              >
                {s.image && <img src={s.image} alt={s.name} className="filter-streamer-avatar" />}
                {s.name}
              </button>
            ))}
          </div>
        )}

        {message.text && (
          <div className={`shop-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="boosters-container">
          <button
            className="carousel-arrow carousel-arrow-left"
            onClick={() => scrollCarousel('left')}
            aria-label="Précédent"
          >←</button>

          <div className="boosters-grid">
            {filteredBoosters.length > 0 ? (
              filteredBoosters.map((booster) => (
                <div key={booster.id} className={`booster-card rarity-${booster.rarity}`}>
                  {/* Streamer tag */}
                  {(booster.creator_display_name || booster.creator_name) && (
                    <div className="booster-streamer-tag">
                      {booster.creator_image && (
                        <img src={booster.creator_image} alt="" className="booster-streamer-avatar" />
                      )}
                      <svg className="booster-twitch-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                      </svg>
                      <span>{booster.creator_display_name || booster.creator_name}</span>
                    </div>
                  )}

                  <div className="booster-header">
                    <h3>{booster.name}</h3>
                    <span className={`booster-rarity rarity-${booster.rarity}`}>
                      {(booster.rarity || 'common').toUpperCase().replace('-', ' ')}
                    </span>
                  </div>

                  {/* 3D Booster preview */}
                  <div className="booster-3d-preview">
                    <BoosterMini3D booster={booster} />
                  </div>

                  <div className="booster-info">
                    <p className="booster-description">{booster.description}</p>
                    <div className="booster-details">
                      <span className="booster-cards">{booster.cards_per_open || booster.cards_count || 5} cartes</span>
                      <span className="booster-price">{booster.price} coins</span>
                    </div>
                  </div>

                  <button
                    className={`booster-buy-btn ${user?.coins < booster.price ? 'insufficient' : ''}`}
                    onClick={() => handlePurchase(booster.id)}
                    disabled={purchasing === booster.id || user?.coins < booster.price}
                  >
                    {purchasing === booster.id ? 'Achat...' : user?.coins < booster.price ? 'Pas assez de coins' : 'Acheter'}
                  </button>
                </div>
              ))
            ) : (
              <div className="no-boosters">
                <p>Aucun booster disponible pour le moment</p>
              </div>
            )}
          </div>

          <button
            className="carousel-arrow carousel-arrow-right"
            onClick={() => scrollCarousel('right')}
            aria-label="Suivant"
          >→</button>
        </div>
      </div>
    </>
  );
}

export default Shop;
