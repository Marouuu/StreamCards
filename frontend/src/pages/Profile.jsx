import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import CardPreview from '../components/CardPreview';
import './Profile.css';

export default function Profile({ onBack, userId, isOwnProfile }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [showShowcase, setShowShowcase] = useState(false);

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getProfile(userId);
      setProfile(data);
      setBioText(data.user?.bio || '');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBio = async () => {
    try {
      await api.updateBio(bioText);
      setEditBio(false);
      toast.success('Bio mise a jour !');
      loadProfile();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-header-skel shimmer" />
        <div className="profile-stats-skel shimmer" />
        <div className="profile-showcase-skel shimmer" />
      </div>
    );
  }

  if (!profile) return null;
  const { user, stats, showcase } = profile;

  return (
    <div className="profile-page">
      <div className="profile-top">
        <button className="profile-back" onClick={onBack}>&larr;</button>
        <h2>Profil</h2>
      </div>

      {/* User card */}
      <div className="profile-user-card">
        <img src={user.profileImageUrl || user.profile_image_url} alt="" className="profile-avatar" />
        <div className="profile-user-info">
          <h3>{user.displayName || user.display_name}</h3>
          <span className="profile-username">@{user.username}</span>
          {user.isStreamer && <span className="profile-streamer-badge">Streamer</span>}
        </div>
      </div>

      {/* Bio */}
      <div className="profile-bio-section">
        {editBio ? (
          <div className="profile-bio-edit">
            <textarea
              value={bioText}
              onChange={e => setBioText(e.target.value)}
              maxLength={500}
              placeholder="Ecrivez quelque chose sur vous..."
            />
            <div className="profile-bio-actions">
              <span className="profile-bio-count">{bioText.length}/500</span>
              <button className="profile-bio-cancel" onClick={() => { setEditBio(false); setBioText(user.bio || ''); }}>Annuler</button>
              <button className="profile-bio-save" onClick={handleSaveBio}>Sauvegarder</button>
            </div>
          </div>
        ) : (
          <div className="profile-bio-display">
            <p>{user.bio || (isOwnProfile ? 'Ajoutez une bio...' : 'Pas de bio')}</p>
            {isOwnProfile && (
              <button className="profile-bio-edit-btn" onClick={() => setEditBio(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.totalCards}</span>
          <span className="profile-stat-label">Cartes totales</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.uniqueCards}</span>
          <span className="profile-stat-label">Cartes uniques</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.tradesCompleted}</span>
          <span className="profile-stat-label">Echanges</span>
        </div>
      </div>

      {/* Showcase */}
      <div className="profile-showcase-section">
        <div className="profile-showcase-header">
          <h3>Vitrine</h3>
          {isOwnProfile && (
            <button className="profile-showcase-edit" onClick={() => setShowShowcase(true)}>
              Modifier
            </button>
          )}
        </div>
        {showcase.length === 0 ? (
          <div className="profile-showcase-empty">
            {isOwnProfile ? 'Ajoutez vos meilleures cartes a votre vitrine !' : 'Pas de cartes en vitrine'}
          </div>
        ) : (
          <div className="profile-showcase-grid">
            {showcase.map(card => (
              <div key={card.position} className="profile-showcase-card">
                <CardPreview card={card} size="medium" />
                <span className="profile-showcase-name">{card.name}</span>
                <span className={`profile-showcase-rarity rarity-${card.rarity}`}>{card.rarity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Showcase editor modal */}
      {showShowcase && (
        <ShowcaseEditor
          userId={userId}
          currentShowcase={showcase}
          onClose={() => setShowShowcase(false)}
          onSaved={() => { setShowShowcase(false); loadProfile(); toast.success('Vitrine mise a jour !'); }}
        />
      )}
    </div>
  );
}

function ShowcaseEditor({ userId, currentShowcase, onClose, onSaved }) {
  const toast = useToast();
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(
    currentShowcase.map(s => ({ userCardId: s.user_card_id, position: s.position }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getUserCards();
        setCards(data.cards || []);
      } catch (e) { toast.error(e.message); }
    })();
  }, []);

  const toggleCard = (cardId) => {
    const exists = selected.find(s => s.userCardId === cardId);
    if (exists) {
      setSelected(prev => prev.filter(s => s.userCardId !== cardId));
    } else if (selected.length < 5) {
      setSelected(prev => [...prev, { userCardId: cardId, position: prev.length + 1 }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const mapped = selected.map((s, i) => ({ userCardId: s.userCardId, position: i + 1 }));
      await api.updateShowcase(mapped);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal" onClick={e => e.stopPropagation()}>
        <button className="trade-modal-close" onClick={onClose}>&times;</button>
        <h3>Modifier la vitrine</h3>
        <p className="trade-step-label">Selectionnez jusqu'a 5 cartes ({selected.length}/5)</p>
        <div className="showcase-editor-grid">
          {cards.map(c => (
            <div
              key={c.id}
              className={`trade-picker-card${selected.find(s => s.userCardId === c.id) ? ' selected' : ''}`}
              onClick={() => toggleCard(c.id)}
            >
              <CardPreview card={c} size="tiny" />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
        <div className="trade-modal-actions">
          <button className="trade-modal-back" onClick={onClose}>Annuler</button>
          <button className="trade-modal-send" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
