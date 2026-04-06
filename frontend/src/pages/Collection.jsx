import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../config/api';
import { getToken } from '../utils/auth';
import { useToast } from '../components/Toast';
import CardPreview from '../components/CardPreview';
import CardDetailModal from '../components/CardDetailModal';
import './Collection.css';

function Collection({ onBack, onUserUpdate }) {
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState({ totalCards: 0, uniqueCards: 0, duplicates: 0 });
  const [loading, setLoading] = useState(true);
  const [recycling, setRecycling] = useState(null);
  const [recyclingAll, setRecyclingAll] = useState(false);
  const [filters, setFilters] = useState({
    rarity: 'all',
    streamer: 'all',
    booster: 'all',
    search: '',
    sort: 'newest',
  });
  const [groupBy, setGroupBy] = useState('all');
  const [stackDuplicates, setStackDuplicates] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const toast = useToast();

  const loadCollection = useCallback(async () => {
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
        setCards(data.cards || []);
        setStats(data.stats || { totalCards: 0, uniqueCards: 0, duplicates: 0 });
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  // Recycle a single duplicate card
  const handleRecycle = async (cardId) => {
    if (recycling) return;
    setRecycling(cardId);
    try {
      const data = await api.recycleCard(cardId);
      toast.success(`Carte recyclee ! +${data.coinsEarned} coins`);
      if (onUserUpdate) {
        const userData = await api.getCurrentUser();
        if (userData) onUserUpdate(userData);
      }
      await loadCollection();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecycling(null);
    }
  };

  // Recycle ALL duplicates
  const handleRecycleAll = async () => {
    if (recyclingAll || stats.duplicates === 0) return;
    if (!confirm(`Recycler ${stats.duplicates} doublon(s) pour ${stats.duplicates * 10} coins ?`)) return;
    setRecyclingAll(true);
    try {
      const data = await api.recycleAll();
      toast.success(`${data.recycledCount} doublon(s) recycle(s) ! +${data.coinsEarned} coins`);
      if (onUserUpdate) {
        const userData = await api.getCurrentUser();
        if (userData) onUserUpdate(userData);
      }
      await loadCollection();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecyclingAll(false);
    }
  };

  // Unique streamers and boosters for filter dropdowns
  const streamers = useMemo(() => {
    const map = new Map();
    for (const c of cards) {
      if (c.creator_id && !map.has(c.creator_id)) {
        map.set(c.creator_id, c.creator_display_name || c.creator_name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [cards]);

  const boosters = useMemo(() => {
    const map = new Map();
    for (const c of cards) {
      if (c.booster_pack_id && !map.has(c.booster_pack_id)) {
        map.set(c.booster_pack_id, { name: c.booster_pack_name, rarity: c.booster_rarity });
      }
    }
    return [...map.entries()].map(([id, info]) => ({ id, ...info }));
  }, [cards]);

  // Filter cards
  const filteredCards = useMemo(() => {
    let result = cards.filter(card => {
      if (filters.rarity !== 'all' && card.rarity !== filters.rarity) return false;
      if (filters.streamer !== 'all' && card.creator_id !== filters.streamer) return false;
      if (filters.booster !== 'all' && card.booster_pack_id !== parseInt(filters.booster)) return false;
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      if (filters.sort === 'newest') return new Date(b.obtained_at) - new Date(a.obtained_at);
      if (filters.sort === 'oldest') return new Date(a.obtained_at) - new Date(b.obtained_at);
      if (filters.sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (filters.sort === 'rarity') {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
        return order.indexOf(b.rarity) - order.indexOf(a.rarity);
      }
      return 0;
    });

    return result;
  }, [cards, filters]);

  // Stack duplicates
  const displayCards = useMemo(() => {
    if (!stackDuplicates) return filteredCards.map(c => ({ ...c, stackCount: 1, allIds: [c.id] }));

    const map = new Map();
    for (const card of filteredCards) {
      if (!map.has(card.card_template_id)) {
        map.set(card.card_template_id, { ...card, stackCount: 1, allIds: [card.id] });
      } else {
        const existing = map.get(card.card_template_id);
        existing.stackCount += 1;
        existing.allIds.push(card.id);
      }
    }
    return [...map.values()];
  }, [filteredCards, stackDuplicates]);

  // Group cards
  const groupedCards = useMemo(() => {
    if (groupBy === 'all') return [{ key: 'all', label: null, cards: displayCards }];

    const groups = new Map();
    for (const card of displayCards) {
      let key, label, icon;
      if (groupBy === 'streamer') {
        key = card.creator_id || 'unknown';
        label = card.creator_display_name || card.creator_name || 'Unknown';
        icon = card.creator_image;
      } else {
        key = card.booster_pack_id || 'unknown';
        label = card.booster_pack_name || 'Unknown Booster';
        icon = null;
      }
      if (!groups.has(key)) {
        groups.set(key, { key, label, icon, rarity: card.booster_rarity, cards: [] });
      }
      groups.get(key).cards.push(card);
    }
    return [...groups.values()];
  }, [displayCards, groupBy]);

  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

  if (loading) {
    return (
      <div className="collection-page">
        <div className="collection-header">
          {onBack && <button className="collection-back-btn" onClick={onBack}>&larr;</button>}
          <h1>Ma Collection</h1>
          <div></div>
        </div>
        <div className="collection-stats-bar">
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton-line skeleton-line--lg" style={{width: '60px', height: '28px'}}></div>
              <div className="skeleton-line skeleton-line--sm" style={{width: '80px'}}></div>
            </div>
          ))}
        </div>
        <div className="collection-skeleton-grid">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-img"></div>
              <div className="skeleton-line skeleton-line--md"></div>
              <div className="skeleton-line skeleton-line--sm"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="collection-page">
      {/* Header */}
      <div className="collection-header">
        {onBack && (
          <button className="collection-back-btn" onClick={onBack}>←</button>
        )}
        <h1>Ma Collection</h1>
        <div></div>
      </div>

      {/* Stats bar */}
      <div className="collection-stats-bar">
        <div className="stat-card">
          <span className="stat-number">{stats.totalCards}</span>
          <span className="stat-label">Cartes totales</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.uniqueCards}</span>
          <span className="stat-label">Cartes uniques</span>
        </div>
        <div className="stat-card stat-card--duplicates">
          <span className="stat-number">{stats.duplicates}</span>
          <span className="stat-label">Doublons</span>
          {stats.duplicates > 0 && (
            <span className="stat-recycle-hint">{stats.duplicates * 10} coins</span>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-number">{streamers.length}</span>
          <span className="stat-label">Streamers</span>
        </div>
      </div>

      {/* Recycle all bar */}
      {stats.duplicates > 0 && (
        <div className="recycle-bar">
          <div className="recycle-info">
            <span className="recycle-icon">&#9851;</span>
            <span>Vous avez <strong>{stats.duplicates} doublon(s)</strong> recyclable(s) pour <strong>{stats.duplicates * 10} coins</strong></span>
          </div>
          <button
            className="recycle-all-btn"
            onClick={handleRecycleAll}
            disabled={recyclingAll}
          >
            {recyclingAll ? 'Recyclage...' : `Tout recycler (+${stats.duplicates * 10} coins)`}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="collection-controls">
        <div className="controls-left">
          <input
            type="text"
            className="collection-search"
            placeholder="Rechercher une carte..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
          />

          <select
            value={filters.rarity}
            onChange={e => setFilters({ ...filters, rarity: e.target.value })}
            className="collection-select"
          >
            <option value="all">Toutes les raretés</option>
            {rarities.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('-', ' ')}</option>
            ))}
          </select>

          <select
            value={filters.streamer}
            onChange={e => setFilters({ ...filters, streamer: e.target.value })}
            className="collection-select"
          >
            <option value="all">Tous les streamers</option>
            {streamers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={filters.booster}
            onChange={e => setFilters({ ...filters, booster: e.target.value })}
            className="collection-select"
          >
            <option value="all">Tous les boosters</option>
            {boosters.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={e => setFilters({ ...filters, sort: e.target.value })}
            className="collection-select"
          >
            <option value="newest">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="rarity">Par rareté</option>
            <option value="name">Par nom</option>
          </select>
        </div>

        <div className="controls-right">
          <div className="group-buttons">
            <button
              className={`group-btn ${groupBy === 'all' ? 'active' : ''}`}
              onClick={() => setGroupBy('all')}
            >Tout</button>
            <button
              className={`group-btn ${groupBy === 'streamer' ? 'active' : ''}`}
              onClick={() => setGroupBy('streamer')}
            >Par streamer</button>
            <button
              className={`group-btn ${groupBy === 'booster' ? 'active' : ''}`}
              onClick={() => setGroupBy('booster')}
            >Par booster</button>
          </div>

          <label className="stack-toggle">
            <input
              type="checkbox"
              checked={stackDuplicates}
              onChange={e => setStackDuplicates(e.target.checked)}
            />
            <span>Empiler les doublons</span>
          </label>
        </div>
      </div>

      {/* Card grid */}
      <div className="collection-content">
        {displayCards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="12" rx="1.5"/>
                <rect x="14" y="2" width="8" height="12" rx="1.5" strokeDasharray="3 2"/>
                <rect x="8" y="10" width="8" height="12" rx="1.5" strokeDasharray="3 2"/>
                <path d="M6 6h0.01"/>
                <path d="M6 10h0.01"/>
              </svg>
            </div>
            <p className="empty-state-title">Votre collection est vide</p>
            <p className="empty-state-hint">Ouvrez des boosters dans le shop pour commencer votre collection !</p>
          </div>
        ) : (
          groupedCards.map(group => (
            <div key={group.key} className="collection-group">
              {group.label && (
                <div className="group-header">
                  {group.icon && (
                    <img src={group.icon} alt={group.label} className="group-icon" />
                  )}
                  <h3>{group.label}</h3>
                  <span className="group-count">{group.cards.length} carte{group.cards.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="collection-grid">
                {group.cards.map((card, idx) => (
                  <div key={`${card.id}-${idx}`} className="collection-card-wrapper" onClick={() => setSelectedCard(card)}>
                    {card.stackCount > 1 && (
                      <span className="stack-count">x{card.stackCount}</span>
                    )}
                    <CardPreview card={card} size="medium" />
                    <div className="card-actions">
                      {card.booster_pack_name && (
                        <span className="card-meta-booster">{card.booster_pack_name}</span>
                      )}
                      {card.duplicate_count > 1 && (
                        <button
                          className="recycle-btn"
                          onClick={() => handleRecycle(card.id)}
                          disabled={recycling === card.id}
                          title="Recycler 1 doublon pour 10 coins"
                        >
                          {recycling === card.id ? '...' : '♻ 10'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}

export default Collection;
