import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import './Achievements.css';

const CATEGORY_LABELS = {
  collection: 'Collection',
  opening: 'Boosters',
  trading: 'Echanges',
  marketplace: 'Marche',
  streak: 'Series',
  rarity: 'Rarete',
  economy: 'Economie',
};

export default function Achievements({ onBack }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      // Also trigger a check for new achievements
      await api.checkAchievements();
      const d = await api.getAchievements();
      setData(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="achievements-page">
        <div className="achievements-header">
          <button className="achievements-back" onClick={onBack}>&larr;</button>
          <h2>Succes</h2>
        </div>
        <div className="achievements-loading">
          {[1,2,3,4,5,6].map(i => <div key={i} className="achievement-skeleton shimmer" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const categories = Object.keys(data.categories || {});
  const allAchievements = data.achievements || [];
  const filtered = filter === 'all' ? allAchievements : allAchievements.filter(a => a.category === filter);

  return (
    <div className="achievements-page">
      <div className="achievements-header">
        <button className="achievements-back" onClick={onBack}>&larr;</button>
        <h2>Succes</h2>
        <div className="achievements-progress-badge">
          {data.unlockedCount}/{data.totalCount}
        </div>
      </div>

      {/* Progress bar */}
      <div className="achievements-progress-bar">
        <div
          className="achievements-progress-fill"
          style={{ width: `${(data.unlockedCount / data.totalCount) * 100}%` }}
        />
      </div>

      {/* Category filter */}
      <div className="achievements-filters">
        <button className={`ach-filter${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tous
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`ach-filter${filter === cat ? ' active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="achievements-grid">
        {filtered.map(ach => (
          <div key={ach.id} className={`achievement-card${ach.unlocked ? ' unlocked' : ' locked'}`}>
            <div className="achievement-icon">{ach.icon}</div>
            <div className="achievement-info">
              <div className="achievement-title">{ach.title}</div>
              <div className="achievement-desc">{ach.description}</div>
              {ach.reward_coins > 0 && (
                <div className="achievement-reward">+{ach.reward_coins} coins</div>
              )}
            </div>
            {ach.unlocked ? (
              <div className="achievement-check">&#10003;</div>
            ) : (
              <div className="achievement-lock">&#128274;</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
