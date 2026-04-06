import { useState, useEffect, useCallback } from 'react';
import { api } from '../config/api';
import { getToken } from '../utils/auth';
import CardPreview from '../components/CardPreview';
import './Marketplace.css';

function Marketplace({ onBack, onUserUpdate, currentUserId }) {
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('browse');
  const [filters, setFilters] = useState({
    rarity: 'all',
    sort: 'newest',
    search: '',
  });

  // Sell modal state
  const [showSellModal, setShowSellModal] = useState(false);
  const [myCards, setMyCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [sellPrice, setSellPrice] = useState(50);
  const [listing, setListing] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3500);
  };

  const loadListings = useCallback(async () => {
    try {
      const params = {};
      if (filters.rarity !== 'all') params.rarity = filters.rarity;
      if (filters.search) params.search = filters.search;
      if (filters.sort === 'price_asc') params.sort = 'price_asc';
      else if (filters.sort === 'price_desc') params.sort = 'price_desc';
      else if (filters.sort === 'rarity') params.sort = 'rarity';

      const data = await api.getMarketplaceListings(params);
      setListings(data.listings || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error loading marketplace:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadMyListings = useCallback(async () => {
    try {
      const data = await api.getMyListings();
      setMyListings(data.listings || []);
    } catch (error) {
      console.error('Error loading my listings:', error);
    }
  }, []);

  useEffect(() => { loadListings(); loadMyListings(); }, [loadListings, loadMyListings]);

  const handleBuy = async (listingId, cardName, price) => {
    if (buying) return;
    if (!confirm(`Acheter "${cardName}" pour ${price} coins ?`)) return;
    setBuying(listingId);
    try {
      const data = await api.buyCard(listingId);
      showMsg('success', `Carte "${cardName}" achetee pour ${price} coins !`);
      if (onUserUpdate) {
        const userData = await api.getCurrentUser();
        if (userData) onUserUpdate(userData);
      }
      await loadListings();
      await loadMyListings();
    } catch (error) {
      showMsg('error', error.message);
    } finally {
      setBuying(null);
    }
  };

  const handleCancel = async (listingId) => {
    if (cancelling) return;
    setCancelling(listingId);
    try {
      await api.cancelListing(listingId);
      showMsg('success', 'Annonce annulee');
      await loadListings();
      await loadMyListings();
    } catch (error) {
      showMsg('error', error.message);
    } finally {
      setCancelling(null);
    }
  };

  // Load user's cards for the sell modal
  const openSellModal = async () => {
    setShowSellModal(true);
    setLoadingCards(true);
    try {
      const userData = await api.getCurrentUser();
      if (!userData) return;
      const token = getToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/cards/collection/${userData.twitchId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setMyCards(data.cards || []);
      }
    } catch (error) {
      console.error('Error loading cards for sell:', error);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleListCard = async () => {
    if (!selectedCard || listing) return;
    setListing(true);
    try {
      await api.listCard(selectedCard.id, sellPrice);
      showMsg('success', `"${selectedCard.name}" mis en vente pour ${sellPrice} coins !`);
      setShowSellModal(false);
      setSelectedCard(null);
      setSellPrice(50);
      await loadListings();
      await loadMyListings();
    } catch (error) {
      showMsg('error', error.message);
    } finally {
      setListing(false);
    }
  };

  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

  const activeListings = myListings.filter(l => l.status === 'active');
  const soldListings = myListings.filter(l => l.status === 'sold');

  if (loading) {
    return (
      <div className="mp-loading">
        <div className="loading-spinner"></div>
        <p>Chargement du marche...</p>
      </div>
    );
  }

  return (
    <div className="marketplace-page">
      {/* Header */}
      <div className="mp-header">
        {onBack && <button className="mp-back-btn" onClick={onBack}>&larr;</button>}
        <h1>Marche</h1>
        <div className="mp-header-right">
          <span className="mp-total">{total} annonce{total !== 1 ? 's' : ''} active{total !== 1 ? 's' : ''}</span>
          <button className="mp-sell-btn" onClick={openSellModal}>
            Vendre une carte
          </button>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mp-message ${message.type}`}>{message.text}</div>
      )}

      {/* Tabs */}
      <div className="mp-tabs">
        <button className={`mp-tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => setActiveTab('browse')}>
          Parcourir
        </button>
        <button className={`mp-tab ${activeTab === 'my-listings' ? 'active' : ''}`} onClick={() => setActiveTab('my-listings')}>
          Mes annonces
          {activeListings.length > 0 && <span className="mp-tab-badge">{activeListings.length}</span>}
        </button>
      </div>

      {activeTab === 'browse' ? (
        <>
          {/* Filters */}
          <div className="mp-controls">
            <input
              type="text"
              className="mp-search"
              placeholder="Rechercher une carte..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
            <select
              value={filters.rarity}
              onChange={e => setFilters({ ...filters, rarity: e.target.value })}
              className="mp-select"
            >
              <option value="all">Toutes les raretes</option>
              {rarities.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('-', ' ')}</option>
              ))}
            </select>
            <select
              value={filters.sort}
              onChange={e => setFilters({ ...filters, sort: e.target.value })}
              className="mp-select"
            >
              <option value="newest">Plus recentes</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix decroissant</option>
              <option value="rarity">Par rarete</option>
            </select>
          </div>

          {/* Listings grid */}
          {listings.length === 0 ? (
            <div className="mp-empty">
              <p>Aucune annonce sur le marche</p>
              <p className="mp-hint">Soyez le premier a vendre une carte !</p>
            </div>
          ) : (
            <div className="mp-grid">
              {listings.map(listing => (
                <div key={listing.id} className="mp-listing-card">
                  <CardPreview card={listing} size="medium" />
                  <div className="mp-listing-info">
                    <span className="mp-listing-name">{listing.name}</span>
                    <div className="mp-listing-seller">
                      {listing.seller_image && (
                        <img src={listing.seller_image} alt={listing.seller_display_name} className="mp-seller-avatar" />
                      )}
                      <span>@{listing.seller_name}</span>
                    </div>
                    <div className="mp-listing-price">
                      <span className="mp-price-value">{listing.price.toLocaleString()}</span>
                      <span className="mp-price-label">coins</span>
                    </div>
                  </div>
                  {listing.seller_id !== currentUserId ? (
                    <button
                      className="mp-buy-btn"
                      onClick={() => handleBuy(listing.id, listing.name, listing.price)}
                      disabled={buying === listing.id}
                    >
                      {buying === listing.id ? '...' : 'Acheter'}
                    </button>
                  ) : (
                    <button
                      className="mp-cancel-btn"
                      onClick={() => handleCancel(listing.id)}
                      disabled={cancelling === listing.id}
                    >
                      {cancelling === listing.id ? '...' : 'Retirer'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* My listings tab */
        <div className="mp-my-listings">
          {activeListings.length > 0 && (
            <>
              <h3 className="mp-section-title">En vente ({activeListings.length})</h3>
              <div className="mp-grid">
                {activeListings.map(l => (
                  <div key={l.id} className="mp-listing-card">
                    <CardPreview card={l} size="medium" />
                    <div className="mp-listing-info">
                      <span className="mp-listing-name">{l.name}</span>
                      <div className="mp-listing-price">
                        <span className="mp-price-value">{l.price.toLocaleString()}</span>
                        <span className="mp-price-label">coins</span>
                      </div>
                    </div>
                    <button
                      className="mp-cancel-btn"
                      onClick={() => handleCancel(l.id)}
                      disabled={cancelling === l.id}
                    >
                      {cancelling === l.id ? '...' : 'Annuler'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {soldListings.length > 0 && (
            <>
              <h3 className="mp-section-title">Vendues ({soldListings.length})</h3>
              <div className="mp-grid">
                {soldListings.map(l => (
                  <div key={l.id} className="mp-listing-card sold">
                    <CardPreview card={l} size="medium" />
                    <div className="mp-listing-info">
                      <span className="mp-listing-name">{l.name}</span>
                      <div className="mp-listing-price">
                        <span className="mp-price-value">{l.price.toLocaleString()}</span>
                        <span className="mp-price-label">coins</span>
                      </div>
                      <span className="mp-sold-to">Achetee par {l.buyer_display_name || '?'}</span>
                    </div>
                    <span className="mp-sold-badge">VENDUE</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeListings.length === 0 && soldListings.length === 0 && (
            <div className="mp-empty">
              <p>Aucune annonce</p>
              <p className="mp-hint">Vendez vos cartes sur le marche !</p>
            </div>
          )}
        </div>
      )}

      {/* Sell modal */}
      {showSellModal && (
        <div className="mp-modal-overlay" onClick={() => setShowSellModal(false)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>Vendre une carte</h2>
              <button className="mp-modal-close" onClick={() => setShowSellModal(false)}>&times;</button>
            </div>

            {loadingCards ? (
              <div className="mp-modal-loading">Chargement de vos cartes...</div>
            ) : (
              <>
                {!selectedCard ? (
                  <div className="mp-modal-body">
                    <p className="mp-modal-hint">Choisissez une carte a vendre :</p>
                    <div className="mp-cards-picker">
                      {myCards.length === 0 ? (
                        <p>Aucune carte dans votre collection</p>
                      ) : (
                        myCards.map(card => (
                          <div
                            key={card.id}
                            className="mp-pick-card"
                            onClick={() => setSelectedCard(card)}
                          >
                            <CardPreview card={card} size="small" />
                            <span className="mp-pick-name">{card.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mp-modal-body mp-confirm-sell">
                    <CardPreview card={selectedCard} size="medium" />
                    <div className="mp-sell-form">
                      <h3>{selectedCard.name}</h3>
                      <span className={`mp-sell-rarity rarity-${selectedCard.rarity}`}>{selectedCard.rarity}</span>
                      <label className="mp-price-label-input">
                        <span>Prix de vente (coins)</span>
                        <input
                          type="number"
                          value={sellPrice}
                          onChange={e => setSellPrice(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                        />
                      </label>
                      <div className="mp-sell-actions">
                        <button className="mp-back-pick" onClick={() => setSelectedCard(null)}>
                          Choisir une autre carte
                        </button>
                        <button
                          className="mp-confirm-btn"
                          onClick={handleListCard}
                          disabled={listing}
                        >
                          {listing ? 'Mise en vente...' : `Vendre pour ${sellPrice} coins`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Marketplace;
