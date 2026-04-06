import { useState, useEffect, useMemo } from 'react';
import { api } from '../config/api';
import { getToken } from '../utils/auth';
import { useToast } from '../components/Toast';
import BoosterMini3D from '../components/BoosterMini3D';
import './Dashboard.css';

function Dashboard({ user: initialUser, onStreamerRequest, onUserUpdate, onNavigate }) {
  const [user, setUser] = useState(initialUser);
  const [boosters, setBoosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingCoins, setAddingCoins] = useState(false);
  const [streamerSearch, setStreamerSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    const loadData = async () => {
      const userData = await api.getCurrentUser();
      if (userData) {
        setUser(userData);
        setLoading(false);
        const token = getToken();

        // Fetch boosters from shop
        try {
          const boostersResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/shop/boosters`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (boostersResponse.ok) {
            const boostersData = await boostersResponse.json();
            setBoosters(boostersData.boosters || []);
          }
        } catch (error) {
          console.error('Error fetching boosters:', error);
        }
      } else {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Group boosters by streamer
  const boostersByStreamer = useMemo(() => {
    const groups = new Map();
    for (const b of boosters) {
      const key = b.creator_id || b.creator_name || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: b.creator_display_name || b.creator_name || 'Inconnu',
          image: b.creator_image,
          boosters: [],
        });
      }
      groups.get(key).boosters.push(b);
    }
    return [...groups.values()];
  }, [boosters]);

  const filteredGroups = useMemo(() => {
    if (!streamerSearch.trim()) return boostersByStreamer;
    const q = streamerSearch.toLowerCase();
    return boostersByStreamer.filter(g => g.name.toLowerCase().includes(q));
  }, [boostersByStreamer, streamerSearch]);

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
      toast.success(`${result.addedCoins.toLocaleString()} coins ajoutes ! Total: ${result.newCoins.toLocaleString()}`);
    } catch (error) {
      console.error('Error adding coins:', error);
      toast.error('Erreur lors de l\'ajout de coins');
    } finally {
      setAddingCoins(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-left">
          <div className="skeleton skeleton-profile">
            <div className="skeleton-circle"></div>
            <div className="skeleton-line skeleton-line--lg"></div>
            <div className="skeleton-line skeleton-line--sm"></div>
          </div>
          <div className="skeleton skeleton-channels">
            {[1,2,3,4].map(i => (
              <div key={i} className="skeleton-channel">
                <div className="skeleton-circle skeleton-circle--sm"></div>
                <div className="skeleton-line skeleton-line--md"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-right">
          <div className="skeleton-line skeleton-line--lg" style={{width: '200px', marginBottom: '1.5rem'}}></div>
          <div className="skeleton skeleton-boosters">
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-booster">
                <div className="skeleton-rect"></div>
                <div className="skeleton-line skeleton-line--md"></div>
                <div className="skeleton-line skeleton-line--sm"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-left">
        {/* Profil utilisateur */}
        <div className="user-profile-card">
          <div className="profile-avatar-wrapper">
            {user?.profileImageUrl && (
              <img
                src={user.profileImageUrl}
                alt={user.displayName || user.username}
                className="profile-avatar"
              />
            )}
            {user?.isStreamer && (
              <span className="verified-badge" title="Streamer verifie">&#10003;</span>
            )}
          </div>
          <h2>{user?.displayName || user?.username}</h2>
          <div className="user-stats">
            <div className="stat-item">
              <span className="stat-label">Coins</span>
              <span className="stat-value">{(user?.coins || 0).toLocaleString()}</span>
            </div>
          </div>
          {user?.isAdmin && (
            <button
              className="add-coins-btn"
              onClick={handleAddCoins}
              disabled={addingCoins}
            >
              {addingCoins ? 'Ajout...' : '+1M Coins (Admin)'}
            </button>
          )}
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

      </div>

      <div className="dashboard-right">
        <div className="dash-shop-header">
          <h3 className="dash-shop-title">Boosters disponibles</h3>
          <input
            type="text"
            className="dash-search"
            placeholder="Rechercher un streamer..."
            value={streamerSearch}
            onChange={(e) => setStreamerSearch(e.target.value)}
          />
        </div>

        {filteredGroups.length > 0 ? (
          filteredGroups.map(group => (
            <div key={group.id} className="dash-streamer-group">
              <div className="dash-streamer-header">
                {group.image && (
                  <img src={group.image} alt={group.name} className="dash-streamer-avatar" />
                )}
                <span className="dash-streamer-name">{group.name}</span>
                <span className="dash-streamer-count">{group.boosters.length} booster{group.boosters.length > 1 ? 's' : ''}</span>
              </div>
              <div className="dash-boosters-row">
                {group.boosters.map(booster => (
                  <div key={booster.id} className="dash-booster-card">
                    <div className="dash-booster-3d">
                      <BoosterMini3D booster={booster} />
                    </div>
                    <div className="dash-booster-info">
                      <span className="dash-booster-name">{booster.name}</span>
                      <span className="dash-booster-price">{booster.price.toLocaleString()} coins</span>
                      <span className="dash-booster-cards">{booster.total_cards || '?'} cartes</span>
                      <button
                        className="dash-buy-btn"
                        onClick={() => onNavigate && onNavigate('shop')}
                      >
                        Acheter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              {streamerSearch ? (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8"/>
                  <path d="M12 17v4"/>
                  <path d="M7 8h.01"/>
                  <path d="M12 8h.01"/>
                  <path d="M17 8h.01"/>
                </svg>
              )}
            </div>
            <p className="empty-state-title">
              {streamerSearch ? `Aucun streamer correspondant a "${streamerSearch}"` : 'Aucun booster disponible'}
            </p>
            <p className="empty-state-hint">
              {streamerSearch ? 'Essayez un autre nom de streamer.' : 'Les streamers doivent creer et publier des boosters pour qu\'ils apparaissent ici.'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;
