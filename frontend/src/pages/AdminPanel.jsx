import { useState, useEffect, useCallback } from 'react';
import { api } from '../config/api';
import CardPreview from '../components/CardPreview';
import './AdminPanel.css';

function AdminPanel({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [pendingPacks, setPendingPacks] = useState([]);
  const [pendingCards, setPendingCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [processing, setProcessing] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [requestsData, packsData, cardsData, usersData, statsData] = await Promise.all([
        api.getStreamerRequests(),
        api.getPendingPacks(),
        api.getPendingCards(),
        api.getAdminUsers(),
        api.getAdminStats(),
      ]);
      setRequests(requestsData.requests || []);
      setPendingPacks(packsData.packs || []);
      setPendingCards(cardsData.cards || []);
      setUsers(usersData.users || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  // Streamer approval
  const handleApproveStreamer = async (twitchId, name) => {
    if (processing) return;
    setProcessing(twitchId);
    try {
      await api.approveStreamer(twitchId);
      showMsg('success', `${name} approuve comme streamer !`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  const handleRejectStreamer = async (twitchId, name) => {
    if (processing) return;
    const note = prompt(`Raison du refus pour ${name} (optionnel) :`);
    if (note === null) return;
    setProcessing(twitchId);
    try {
      await api.rejectStreamer(twitchId, note);
      showMsg('success', `Demande de ${name} refusee`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  // Pack approval
  const handleApprovePack = async (packId, name) => {
    if (processing) return;
    setProcessing(`pack-${packId}`);
    try {
      await api.approvePack(packId);
      showMsg('success', `Booster "${name}" approuve !`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  const handleRejectPack = async (packId, name) => {
    if (processing) return;
    const note = prompt(`Raison du refus pour "${name}" (optionnel) :`);
    if (note === null) return;
    setProcessing(`pack-${packId}`);
    try {
      await api.rejectPack(packId, note);
      showMsg('success', `Booster "${name}" refuse`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  // Card approval
  const handleApproveCard = async (cardId, name) => {
    if (processing) return;
    setProcessing(`card-${cardId}`);
    try {
      await api.approveCard(cardId);
      showMsg('success', `Carte "${name}" approuvee !`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  const handleRejectCard = async (cardId, name) => {
    if (processing) return;
    const note = prompt(`Raison du refus pour "${name}" (optionnel) :`);
    if (note === null) return;
    setProcessing(`card-${cardId}`);
    try {
      await api.rejectCard(cardId, note);
      showMsg('success', `Carte "${name}" refusee`);
      await loadData();
    } catch (e) { showMsg('error', e.message); }
    finally { setProcessing(null); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const map = {
      none: { label: 'Viewer', class: 'badge-viewer' },
      pending: { label: 'En attente', class: 'badge-pending' },
      approved: { label: 'Approuve', class: 'badge-approved' },
      rejected: { label: 'Refuse', class: 'badge-rejected' },
    };
    const info = map[status] || map.none;
    return <span className={`admin-badge ${info.class}`}>{info.label}</span>;
  };

  const totalPending = requests.length + pendingPacks.length + pendingCards.length;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Chargement du panel admin...</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        {onBack && (
          <button className="admin-back-btn" onClick={onBack}>&larr;</button>
        )}
        <h1>Panel Admin</h1>
        <span className="admin-subtitle">Gestion de StreamCards</span>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats-bar">
          <div className="admin-stat">
            <span className="admin-stat-number">{stats.users?.total_users || 0}</span>
            <span className="admin-stat-label">Utilisateurs</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-number">{stats.users?.total_streamers || 0}</span>
            <span className="admin-stat-label">Streamers</span>
          </div>
          <div className={`admin-stat ${totalPending > 0 ? 'highlight' : ''}`}>
            <span className="admin-stat-number">{totalPending}</span>
            <span className="admin-stat-label">En attente</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-number">{stats.packs?.published_packs || 0}</span>
            <span className="admin-stat-label">Boosters actifs</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-number">{stats.cardTemplates?.approved_cards || 0}</span>
            <span className="admin-stat-label">Cartes approuvees</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-number">{stats.cards?.total_cards || 0}</span>
            <span className="admin-stat-label">Cartes en circulation</span>
          </div>
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`admin-message ${message.type}`}>{message.text}</div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Streamers
          {requests.length > 0 && <span className="tab-badge">{requests.length}</span>}
        </button>
        <button
          className={`admin-tab ${activeTab === 'packs' ? 'active' : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          Boosters
          {pendingPacks.length > 0 && <span className="tab-badge">{pendingPacks.length}</span>}
        </button>
        <button
          className={`admin-tab ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          Cartes
          {pendingCards.length > 0 && <span className="tab-badge">{pendingCards.length}</span>}
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Utilisateurs
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {/* ========== STREAMER REQUESTS ========== */}
        {activeTab === 'requests' && (
          requests.length === 0 ? (
            <div className="admin-empty"><p>Aucune demande de streamer en attente</p></div>
          ) : (
            <div className="requests-list">
              {requests.map(req => (
                <div key={req.twitch_id} className="request-card">
                  <div className="request-user-info">
                    {req.profile_image_url && (
                      <img src={req.profile_image_url} alt={req.display_name} className="request-avatar" />
                    )}
                    <div className="request-details">
                      <h3>{req.display_name || req.username}</h3>
                      <span className="request-username">@{req.username}</span>
                      <span className="request-date">Demande le {formatDate(req.streamer_requested_at)}</span>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button className="approve-btn" onClick={() => handleApproveStreamer(req.twitch_id, req.display_name)} disabled={processing === req.twitch_id}>
                      {processing === req.twitch_id ? '...' : 'Approuver'}
                    </button>
                    <button className="reject-btn" onClick={() => handleRejectStreamer(req.twitch_id, req.display_name)} disabled={processing === req.twitch_id}>
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ========== PENDING PACKS ========== */}
        {activeTab === 'packs' && (
          pendingPacks.length === 0 ? (
            <div className="admin-empty"><p>Aucun booster en attente de validation</p></div>
          ) : (
            <div className="requests-list">
              {pendingPacks.map(pack => (
                <div key={pack.id} className="request-card">
                  <div className="request-user-info">
                    {pack.creator_image && (
                      <img src={pack.creator_image} alt={pack.creator_display_name} className="request-avatar" />
                    )}
                    <div className="request-details">
                      <h3>{pack.name}</h3>
                      <span className="request-username">par @{pack.creator_name} ({pack.creator_display_name})</span>
                      <span className="request-date">
                        {pack.rarity} | {pack.price} coins | {pack.total_cards || 0} cartes | {pack.cards_per_open} par ouverture
                      </span>
                      {pack.description && (
                        <span className="request-date" style={{ fontStyle: 'italic' }}>{pack.description}</span>
                      )}
                      {pack.image_url && (
                        <img src={pack.image_url} alt={pack.name} className="pack-preview-img" />
                      )}
                    </div>
                  </div>
                  <div className="request-actions">
                    <button className="approve-btn" onClick={() => handleApprovePack(pack.id, pack.name)} disabled={processing === `pack-${pack.id}`}>
                      {processing === `pack-${pack.id}` ? '...' : 'Approuver'}
                    </button>
                    <button className="reject-btn" onClick={() => handleRejectPack(pack.id, pack.name)} disabled={processing === `pack-${pack.id}`}>
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ========== PENDING CARDS ========== */}
        {activeTab === 'cards' && (
          pendingCards.length === 0 ? (
            <div className="admin-empty"><p>Aucune carte en attente de validation</p></div>
          ) : (
            <div className="pending-cards-grid">
              {pendingCards.map(card => (
                <div key={card.id} className="pending-card-item">
                  <CardPreview card={card} size="medium" />
                  <div className="pending-card-info">
                    <h4>{card.name}</h4>
                    <span className="request-username">par @{card.creator_name}</span>
                    <span className="request-date">Booster: {card.booster_pack_name}</span>
                    <span className={`admin-badge badge-${card.rarity}`}>{card.rarity}</span>
                    {card.image_url && <span className="request-date" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{card.image_url}</span>}
                  </div>
                  <div className="pending-card-actions">
                    <button className="approve-btn" onClick={() => handleApproveCard(card.id, card.name)} disabled={processing === `card-${card.id}`}>
                      {processing === `card-${card.id}` ? '...' : 'OK'}
                    </button>
                    <button className="reject-btn" onClick={() => handleRejectCard(card.id, card.name)} disabled={processing === `card-${card.id}`}>
                      Non
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ========== USERS ========== */}
        {activeTab === 'users' && (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Statut</th>
                  <th>Coins</th>
                  <th>Admin</th>
                  <th>Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.twitch_id}>
                    <td className="user-cell">
                      {u.profile_image_url && (
                        <img src={u.profile_image_url} alt={u.display_name} className="table-avatar" />
                      )}
                      <div>
                        <span className="table-name">{u.display_name || u.username}</span>
                        <span className="table-username">@{u.username}</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(u.streamer_status)}</td>
                    <td className="coins-cell">{(u.coins || 0).toLocaleString()}</td>
                    <td>{u.is_admin ? <span className="admin-badge badge-admin">Admin</span> : '-'}</td>
                    <td className="date-cell">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
