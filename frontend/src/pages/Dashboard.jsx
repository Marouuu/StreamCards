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
  const [collectionStats, setCollectionStats] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [achievements, setAchievements] = useState(null);
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

        // Fetch collection progress
        try {
          const progress = await api.getCollectionProgress();
          setCollectionStats(progress);
        } catch {}

        // Fetch rewards/quests status
        try {
          const rewardsData = await api.getRewards();
          setRewards(rewardsData);
        } catch {}

        // Fetch achievements
        try {
          const achievData = await api.getAchievements();
          setAchievements(achievData);
        } catch {}
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
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h8" opacity="0.7"/></svg>
              </span>
              <span className="stat-label">Coins</span>
              <span className="stat-value">{(user?.coins || 0).toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </span>
              <span className="stat-label">Cartes</span>
              <span className="stat-value">{collectionStats?.totalCards || user?.totalCards || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </span>
              <span className="stat-label">Uniques</span>
              <span className="stat-value">{collectionStats?.uniqueCards || user?.uniqueCards || 0}</span>
            </div>
          </div>

          {/* Collection progress bar */}
          {collectionStats && collectionStats.totalAvailable > 0 && (
            <div className="collection-progress">
              <div className="progress-header">
                <span className="progress-label">Collection</span>
                <span className="progress-percent">{Math.round((collectionStats.uniqueCards / collectionStats.totalAvailable) * 100)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (collectionStats.uniqueCards / collectionStats.totalAvailable) * 100)}%` }} />
              </div>
              <span className="progress-detail">{collectionStats.uniqueCards} / {collectionStats.totalAvailable}</span>
            </div>
          )}

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

        {/* Quick Actions */}
        <div className="quick-actions-card">
          <h3 className="quick-actions-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Actions rapides
          </h3>
          <div className="quick-actions-grid">
            <button className="quick-action-btn" onClick={() => onNavigate && onNavigate('collection')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Collection</span>
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate && onNavigate('trades')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              <span>Echanges</span>
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate && onNavigate('rewards')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span>Quetes</span>
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate && onNavigate('marketplace')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              <span>Marche</span>
            </button>
          </div>
        </div>

        {/* Achievements summary */}
        {achievements && achievements.achievements && (
          <div className="achievements-summary-card" onClick={() => onNavigate && onNavigate('achievements')}>
            <h3 className="achievements-summary-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
              Succes
            </h3>
            <div className="achievements-summary-stats">
              <span className="achievements-unlocked">
                {achievements.achievements.filter(a => a.unlocked).length}
              </span>
              <span className="achievements-separator">/</span>
              <span className="achievements-total">{achievements.achievements.length}</span>
            </div>
            <div className="achievements-summary-bar">
              <div className="achievements-summary-fill" style={{
                width: `${achievements.achievements.length > 0 ? (achievements.achievements.filter(a => a.unlocked).length / achievements.achievements.length) * 100 : 0}%`
              }} />
            </div>
            <span className="achievements-summary-hint">Voir tous les succes →</span>
          </div>
        )}

        {/* Quests summary */}
        {rewards && rewards.quests && rewards.quests.length > 0 && (
          <div className="quests-summary-card">
            <h3 className="quests-summary-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Quetes en cours
            </h3>
            <div className="quests-list">
              {rewards.quests.filter(q => !q.claimed).slice(0, 3).map((quest, i) => (
                <div key={i} className="quest-mini-item">
                  <div className="quest-mini-info">
                    <span className="quest-mini-name">{quest.title || quest.description}</span>
                    <div className="quest-mini-bar">
                      <div className="quest-mini-fill" style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="quest-mini-progress">{quest.progress}/{quest.target}</span>
                </div>
              ))}
            </div>
            <button className="quests-see-all" onClick={() => onNavigate && onNavigate('rewards')}>
              Voir toutes les quetes →
            </button>
          </div>
        )}

        {/* Streamer status banner */}
        {user && !user.isStreamer && (
          <div className={`streamer-status-banner ${user.streamerStatus || 'none'}`}>
            {user.streamerStatus === 'pending' ? (
              <div className="status-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
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
          <h3 className="dash-shop-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            Boosters disponibles
          </h3>
          <div className="dash-search-wrapper">
            <svg className="dash-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              className="dash-search"
              placeholder="Rechercher un streamer..."
              value={streamerSearch}
              onChange={(e) => setStreamerSearch(e.target.value)}
            />
          </div>
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
