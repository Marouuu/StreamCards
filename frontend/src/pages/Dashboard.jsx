import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { getToken } from '../utils/auth';
import './Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [followedChannels, setFollowedChannels] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres pour la collection
  const [filters, setFilters] = useState({
    rarity: 'all',
    boosterType: 'all',
    streamer: 'all',
  });

  useEffect(() => {
    console.log('Dashboard: useEffect triggered');
    const loadData = async () => {
      console.log('Dashboard: Loading data...');
      const userData = await api.getCurrentUser();
      console.log('Dashboard: User data:', userData);
      
      if (userData) {
        setUser(userData);
        setLoading(false);
        // Load additional data with userData
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
        </div>

        {/* Chaînes suivies */}
        <div className="followed-channels-card">
          <h3>Chaînes suivies</h3>
          <div className="channels-list">
            {followedChannels.length > 0 ? (
              followedChannels.slice(0, 10).map((channel) => (
                <div key={channel.id} className="channel-item">
                  <img 
                    src={channel.profile_image_url || channel.thumbnail_url} 
                    alt={channel.display_name}
                    className="channel-avatar"
                  />
                  <div className="channel-info">
                    <span className="channel-name">{channel.display_name}</span>
                    {channel.viewer_count !== undefined && (
                      <span className="channel-viewers">{channel.viewer_count} viewers</span>
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

