import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { getToken, setToken } from '../utils/auth';
import './Shop.css';

function Shop({ onBack, onUserUpdate }) {
  const [boosters, setBoosters] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load user data
        const userData = await api.getCurrentUser();
        if (userData) {
          setUser(userData);
        }

        // Load boosters
        const token = getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/shop/boosters`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setBoosters(data.boosters || []);
        } else {
          console.error('Error fetching boosters');
        }
      } catch (error) {
        console.error('Error loading shop data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const scrollCarousel = (direction) => {
    const carousel = document.querySelector('.boosters-grid');
    if (!carousel) return;
    
    const cardWidth = 320; // Width of each booster card
    const gap = 32; // Gap between cards (2rem = 32px)
    const scrollAmount = cardWidth + gap;
    
    if (direction === 'left') {
      carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
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

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Achat réussi ! Vous avez obtenu ${data.cards?.length || 0} carte(s).` });
        
        // Update token if new token provided
        if (data.newToken) {
          setToken(data.newToken);
        }
        
        // Update user coins
        const userData = await api.getCurrentUser();
        if (userData) {
          setUser(userData);
          // Notify parent component to update user
          if (onUserUpdate) {
            onUserUpdate(userData);
          }
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de l\'achat' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error purchasing booster:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'achat' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
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
    <div className="shop">
      <div className="shop-header">
        {onBack && (
          <button className="shop-back-btn" onClick={onBack}>
            ←
          </button>
        )}
        <h1>🛒 Boutique</h1>
        <div></div>
      </div>

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
        >
          ←
        </button>
        <div className="boosters-grid">
          {boosters.length > 0 ? (
            boosters.map((booster) => (
            <div key={booster.id} className={`booster-card rarity-${booster.rarity}`}>
              <div className="booster-header">
                <h3>{booster.name}</h3>
                <span className={`booster-rarity rarity-${booster.rarity}`}>
                  {booster.rarity === 'ultra-legendary' ? 'ULTRA LEGENDARY' : 
                   booster.rarity === 'common' ? 'COMMON' :
                   booster.rarity === 'uncommon' ? 'UNCOMMON' :
                   booster.rarity === 'rare' ? 'RARE' :
                   booster.rarity === 'epic' ? 'EPIC' :
                   booster.rarity === 'legendary' ? 'LEGENDARY' : booster.rarity.toUpperCase()}
                </span>
              </div>
              
              <div className="booster-image">
                <div className="booster-icon">📦</div>
              </div>

              <div className="booster-info">
                <p className="booster-description">{booster.description}</p>
                <div className="booster-details">
                  <span className="booster-cards">{booster.cards_count} cartes</span>
                  <span className="booster-price">
                    💰 {booster.price} coins
                  </span>
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
        >
          →
        </button>
      </div>
    </div>
  );
}

export default Shop;

