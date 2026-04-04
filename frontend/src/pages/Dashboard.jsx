import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { getToken } from '../utils/auth';
import './Dashboard.css';

function Dashboard({ user: initialUser, onStreamerRequest, onUserUpdate }) {
  const [user, setUser] = useState(initialUser);
  const [followedChannels, setFollowedChannels] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelSort, setChannelSort] = useState('watched');
  const [addingCoins, setAddingCoins] = useState(false);

  const [filters, setFilters] = useState({
    rarity: 'all',
    boosterType: 'all',
    streamer: 'all',
  });

  useEffect(() => {
    const loadData = async () => {
      const userData = await api.getCurrentUser();
      if (userData) {
        setUser(userData);
        setLoading(false);
        const token = getToken();
        
        // Fetch followed channels
        try {
          console.log('Dashboard: Fetching followed channels...');
          const channelsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/user/followed`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('Dashboard: Channels response status:', channelsResponse.status);
          if (channelsResponse.ok) {
            const channelsData = await channelsResponse.json();
            console.log('Dashboard: Channels data:', channelsData);
            setFollowedChannels(channelsData.channels || []);
          } else {
            const errorText = await channelsResponse.text();
            console.error('Dashboard: Channels error:', errorText);
          }
        } catch (error) {
          console.error('Dashboard: Error fetching followed channels:', error);
        }

        // Fetch user collection (using Twitch ID)
        try {
          console.log('Dashboard: Fetching collection for user:', userData.twitchId);
          const collectionResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/cards/collection/${userData.twitchId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('Dashboard: Collection response status:', collectionResponse.status);
          if (collectionResponse.ok) {
            const collectionData = await collectionResponse.json();
            console.log('Dashboard: Collection data:', collectionData);
            setCards(collectionData.cards || []);
          } else {
            const errorText = await collectionResponse.text();
            console.error('Dashboard: Collection error:', errorText);
            setCards([]);
          }
        } catch (error) {
          console.error('Dashboard: Error fetching collection:', error);
          setCards([]);
        }
      } else {
        console.log('Dashboard: No user data, setting loading to false');
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredCards = cards.filter(card => {
    if (filters.rarity !== 'all' && card.rarity !== filters.rarity) return false;
    if (filters.boosterType !== 'all' && card.boosterType !== filters.boosterType) return false;
    if (filters.streamer !== 'all' && card.streamer_id !== parseInt(filters.streamer)) return false;
    return true;
  });

  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const uniqueStreamers = [...new Map(cards.map(card => [card.streamer_id, { id: card.streamer_id, name: card.streamer_display_name || card.streamer_name }])).values()];

  // Trier les chaînes selon le filtre sélectionné
  const handleAddCoins = async () => {
    if (addingCoins) return;

    setAddingCoins(true);
    try {
      const result = await api.addCoins(1000000);
      const userData = await api.getCurrentUser();
      if (userData) {
        setUser(userData);
        if (onUserUpdate) onUserUpdate(userData);
      }
      alert(`${result.addedCoins.toLocaleString()} coins ajoutes ! Total: ${result.newCoins.toLocaleString()}`);
    } catch (error) {
      console.error('Error adding coins:', error);
      alert('Erreur lors de l\'ajout de coins');
    } finally {
      setAddingCoins(false);
    }
  };

  const sortedChannels = [...followedChannels].sort((a, b) => {
    if (channelSort === 'watched') {
      // Trier par date de suivi (les plus récemment suivies en premier)
      // Cela indique les chaînes que l'utilisateur regarde le plus
      const dateA = new Date(a.followed_at || 0);
      const dateB = new Date(b.followed_at || 0);
      return dateB - dateA; // Plus récent en premier
    } else if (channelSort === 'viewers') {
      return (b.viewer_count || 0) - (a.viewer_count || 0);
    } else {
      return (a.display_name || '').localeCompare(b.display_name || '');
    }
  });

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-left">
        {/* Profil utilisateur */}
        <div className="user-profile-card">
          {user?.profileImageUrl && (
            <img 
              src={user.profileImageUrl} 
              alt={user.displayName || user.username}
              className="profile-avatar"
            />
          )}
          <h2>{user?.displayName || user?.username}</h2>
          <div className="user-stats">
            <div className="stat-item">
              <span className="stat-label">Coins</span>
              <span className="stat-value">{user?.coins || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Cartes</span>
              <span className="stat-value">{cards.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Streamers</span>
              <span className="stat-value">{uniqueStreamers.length}</span>
            </div>
          </div>
          <button
            className="add-coins-btn"
            onClick={handleAddCoins}
            disabled={addingCoins}
          >
            {addingCoins ? 'Ajout...' : '+1M Coins (Dev)'}
          </button>
        </div>

        {/* Streamer status banner */}
        {user && !user.isStreamer && (
          <div className={`streamer-status-banner ${user.streamerStatus || 'none'}`}>
            {user.streamerStatus === 'pending' ? (
              <div className="status-info">
                <span className="status-icon">&#9203;</span>
                <div>
                  <strong>Demande en cours</strong>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                    Votre demande de streamer est en attente de validation
                  </p>
                </div>
              </div>
            ) : user.streamerStatus === 'rejected' ? (
              <>
                <div className="status-info">
                  <span className="status-icon">&#10060;</span>
                  <div>
                    <strong>Demande refusee</strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                      Votre demande de streamer a ete refusee
                    </p>
                  </div>
                </div>
                <button className="request-streamer-btn" onClick={onStreamerRequest}>
                  Re-demander
                </button>
              </>
            ) : (
              <>
                <div className="status-info">
                  <span className="status-icon">&#127909;</span>
                  <span>Vous etes un streamer ? Creez vos propres boosters et cartes !</span>
                </div>
                <button className="request-streamer-btn" onClick={onStreamerRequest}>
                  Devenir Streamer
                </button>
              </>
            )}
          </div>
        )}

        {user && user.isStreamer && (
          <div className="streamer-status-banner" style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            <div className="status-info">
              <span className="status-icon">&#9989;</span>
              <span><strong>Streamer verifie</strong> — Vous pouvez creer des boosters et des cartes</span>
            </div>
          </div>
        )}

        {/* Chaînes suivies */}
        <div className="followed-channels-card">
          <div className="channels-header">
            <h3>Chaînes suivies</h3>
            <select 
              value={channelSort} 
              onChange={(e) => setChannelSort(e.target.value)}
              className="channel-sort-select"
            >
              <option value="watched">Mes chaînes (plus regardées)</option>
              <option value="viewers">Plus populaires</option>
              <option value="name">Par nom</option>
            </select>
          </div>
          <div className="channels-list">
            {sortedChannels.length > 0 ? (
              sortedChannels.slice(0, 10).map((channel) => (
                <div key={channel.id} className={`channel-item ${channel.is_live ? 'live' : ''}`}>
                  <img 
                    src={channel.profile_image_url || channel.thumbnail_url} 
                    alt={channel.display_name}
                    className="channel-avatar"
                  />
                  <div className="channel-info">
                    <span className="channel-name">{channel.display_name}</span>
                    {channel.is_live ? (
                      <span className="channel-viewers live-indicator">
                        🔴 LIVE • {channel.viewer_count || 0} viewers
                      </span>
                    ) : (
                      channel.viewer_count !== undefined && (
                        <span className="channel-viewers">{channel.viewer_count} viewers</span>
                      )
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="no-channels">Aucune chaîne suivie pour le moment</p>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-right">
        {/* Filtres */}
        <div className="collection-filters">
          <h3>Ma Collection</h3>
          <div className="filters-row">
            <div className="filter-group">
              <label>Rareté</label>
              <select 
                value={filters.rarity} 
                onChange={(e) => setFilters({...filters, rarity: e.target.value})}
              >
                <option value="all">Toutes</option>
                {rarities.map(rarity => (
                  <option key={rarity} value={rarity}>
                    {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Type de Booster</label>
              <select 
                value={filters.boosterType} 
                onChange={(e) => setFilters({...filters, boosterType: e.target.value})}
              >
                <option value="all">Tous</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="legendary">Légendaire</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Streamer</label>
              <select 
                value={filters.streamer} 
                onChange={(e) => setFilters({...filters, streamer: e.target.value})}
              >
                <option value="all">Tous</option>
                {uniqueStreamers.map(streamer => (
                  <option key={streamer.id} value={streamer.id}>
                    {streamer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Collection de cartes */}
        <div className="cards-grid">
          {filteredCards.length > 0 ? (
            filteredCards.map((card) => (
              <div key={card.id} className={`card-item rarity-${card.rarity}`}>
                <div className="card-image">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} />
                  ) : (
                    <div className="card-placeholder">{card.name}</div>
                  )}
                </div>
                <div className="card-info">
                  <h4>{card.name}</h4>
                  <p className="card-streamer">{card.streamer_display_name || card.streamer_name}</p>
                  <span className={`card-rarity rarity-${card.rarity}`}>
                    {card.rarity}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-cards">
              <p>Aucune carte dans votre collection</p>
              <p className="hint">Achetez des boosters pour commencer votre collection !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

