import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import CardPreview from '../components/CardPreview';
import './Analytics.css';

const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

export default function Analytics({ onBack }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getAnalytics();
        setData(d);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-header">
          <button className="analytics-back" onClick={onBack}>&larr;</button>
          <h2>Analytics</h2>
        </div>
        <div className="analytics-loading">
          {[1,2,3,4].map(i => <div key={i} className="analytics-skeleton shimmer" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { overview, popularCards, rarityDistribution, recentActivity, completionRates } = data;

  const totalRarity = rarityDistribution.reduce((sum, r) => sum + parseInt(r.count), 0) || 1;

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <button className="analytics-back" onClick={onBack}>&larr;</button>
        <h2>Analytics Streamer</h2>
      </div>

      {/* Overview stats */}
      <div className="analytics-stats-grid">
        <div className="analytics-stat">
          <span className="analytics-stat-value">{overview.totalCards}</span>
          <span className="analytics-stat-label">Cartes creees</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-value">{overview.totalPacks}</span>
          <span className="analytics-stat-label">Packs</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-value">{overview.uniqueCollectors}</span>
          <span className="analytics-stat-label">Collectionneurs</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-value">{overview.totalCollected.toLocaleString()}</span>
          <span className="analytics-stat-label">Cartes collectees</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-value">{overview.boostersOpened.toLocaleString()}</span>
          <span className="analytics-stat-label">Boosters ouverts</span>
        </div>
        <div className="analytics-stat highlight">
          <span className="analytics-stat-value">{overview.coinsSpent.toLocaleString()}</span>
          <span className="analytics-stat-label">Coins depenses</span>
        </div>
        <div className="analytics-stat highlight">
          <span className="analytics-stat-value">{overview.marketVolume.toLocaleString()}</span>
          <span className="analytics-stat-label">Volume marche</span>
        </div>
      </div>

      {/* Rarity distribution */}
      <div className="analytics-section">
        <h3>Distribution par rarete</h3>
        <div className="rarity-bars">
          {rarityDistribution.map(r => (
            <div key={r.rarity} className="rarity-bar-row">
              <span className="rarity-bar-label" style={{ color: RARITY_COLORS[r.rarity] }}>
                {r.rarity}
              </span>
              <div className="rarity-bar-track">
                <div
                  className="rarity-bar-fill"
                  style={{
                    width: `${(parseInt(r.count) / totalRarity) * 100}%`,
                    background: RARITY_COLORS[r.rarity],
                  }}
                />
              </div>
              <span className="rarity-bar-count">{parseInt(r.count).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Collection completion */}
      <div className="analytics-section">
        <h3>Taux de completion</h3>
        <div className="completion-stats">
          <div className="completion-stat">
            <span className="completion-value" style={{ color: '#2ecc71' }}>{completionRates.complete || 0}</span>
            <span className="completion-label">100% complet</span>
          </div>
          <div className="completion-stat">
            <span className="completion-value" style={{ color: '#f1c40f' }}>{completionRates.half || 0}</span>
            <span className="completion-label">50-99%</span>
          </div>
          <div className="completion-stat">
            <span className="completion-value" style={{ color: '#e74c3c' }}>{completionRates.started || 0}</span>
            <span className="completion-label">1-49%</span>
          </div>
        </div>
      </div>

      {/* Popular cards */}
      <div className="analytics-section">
        <h3>Cartes les plus populaires</h3>
        <div className="popular-cards-grid">
          {popularCards.map((card, i) => (
            <div key={card.id} className="popular-card-item">
              <span className="popular-rank">#{i + 1}</span>
              <CardPreview card={card} size="tiny" />
              <div className="popular-card-info">
                <span className="popular-card-name">{card.name}</span>
                <span className="popular-card-stats">
                  {parseInt(card.copies)} copies &middot; {parseInt(card.unique_owners)} joueurs
                </span>
              </div>
            </div>
          ))}
          {popularCards.length === 0 && (
            <p className="analytics-empty">Aucune carte collectee pour le moment</p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="analytics-section">
        <h3>Activite recente</h3>
        <div className="activity-list">
          {recentActivity.map((a, i) => (
            <div key={i} className="activity-item">
              {a.user_image && <img src={a.user_image} alt="" className="activity-avatar" />}
              <div className="activity-info">
                <span className="activity-user">{a.user_name}</span>
                <span className="activity-action">a ouvert <strong>{a.pack_name}</strong></span>
              </div>
              <span className="activity-coins">{a.coins_spent} coins</span>
              <span className="activity-time">{formatTime(a.opened_at)}</span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p className="analytics-empty">Aucune activite recente</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'A l\'instant';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}
