import { useState, useEffect, useCallback } from 'react';
import { api } from '../config/api';
import './Leaderboard.css';

const CATEGORIES = [
  { key: 'collection', label: 'Collection', icon: '\uD83C\uDCCF', desc: 'Total de cartes' },
  { key: 'rare', label: 'Cartes Rares', icon: '\u2B50', desc: 'Legendaires & Ultra' },
  { key: 'coins', label: 'Fortune', icon: '\uD83D\uDCB0', desc: 'Coins accumules' },
  { key: 'trades', label: 'Trades', icon: '\uD83E\uDD1D', desc: 'Echanges realises' },
];

function Leaderboard({ onBack }) {
  const [category, setCategory] = useState('collection');
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLeaderboard(category);
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const currentCat = CATEGORIES.find(c => c.key === category);

  const formatScore = (score, cat) => {
    if (cat === 'coins') return score.toLocaleString();
    return score.toString();
  };

  const getScoreUnit = (cat) => {
    switch (cat) {
      case 'collection': return 'cartes';
      case 'rare': return 'rares';
      case 'coins': return 'coins';
      case 'trades': return 'trades';
      default: return '';
    }
  };

  const getMedalClass = (rank) => {
    if (rank === 1) return 'lb-gold';
    if (rank === 2) return 'lb-silver';
    if (rank === 3) return 'lb-bronze';
    return '';
  };

  const getMedal = (rank) => {
    if (rank === 1) return '\uD83E\uDD47';
    if (rank === 2) return '\uD83E\uDD48';
    if (rank === 3) return '\uD83E\uDD49';
    return `#${rank}`;
  };

  return (
    <div className="leaderboard-page">
      {/* Header */}
      <div className="lb-header">
        {onBack && <button className="lb-back-btn" onClick={onBack}>&larr;</button>}
        <h1>Classement</h1>
        {myRank && (
          <div className="lb-my-rank">
            Votre rang: <strong>#{myRank}</strong>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="lb-categories">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`lb-cat-btn ${category === cat.key ? 'active' : ''}`}
            onClick={() => setCategory(cat.key)}
          >
            <span className="lb-cat-icon">{cat.icon}</span>
            <span className="lb-cat-label">{cat.label}</span>
            <span className="lb-cat-desc">{cat.desc}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="lb-loading">
          <div className="loading-spinner"></div>
          <p>Chargement du classement...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="lb-empty">
          <p>Aucun joueur dans cette categorie</p>
          <p className="lb-empty-hint">Soyez le premier !</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {leaderboard.length >= 3 && (
            <div className="lb-podium">
              {[1, 0, 2].map(idx => {
                const player = leaderboard[idx];
                if (!player) return null;
                return (
                  <div key={player.twitchId} className={`lb-podium-item podium-${idx + 1}`}>
                    <div className="lb-podium-medal">{getMedal(player.rank)}</div>
                    <div className="lb-podium-avatar-wrap">
                      {player.profileImageUrl ? (
                        <img src={player.profileImageUrl} alt={player.displayName} className="lb-podium-avatar" />
                      ) : (
                        <div className="lb-podium-avatar lb-avatar-placeholder">
                          {(player.displayName || player.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      {player.isStreamer && <span className="lb-streamer-badge-podium">STREAMER</span>}
                    </div>
                    <span className="lb-podium-name">
                      {player.displayName || player.username}
                      {player.isPremium && <span className="lb-premium-badge" title="StreamCards+">&#11088;</span>}
                    </span>
                    <span className="lb-podium-score">
                      {formatScore(player.score, category)}
                      <span className="lb-podium-unit">{getScoreUnit(category)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className="lb-list">
            {leaderboard.map(player => (
              <div
                key={player.twitchId}
                className={`lb-row ${getMedalClass(player.rank)}`}
              >
                <span className="lb-rank">{getMedal(player.rank)}</span>
                <div className="lb-player">
                  {player.profileImageUrl ? (
                    <img src={player.profileImageUrl} alt={player.displayName} className="lb-avatar" />
                  ) : (
                    <div className="lb-avatar lb-avatar-placeholder">
                      {(player.displayName || player.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="lb-player-info">
                    <span className="lb-player-name">
                      {player.displayName || player.username}
                      {player.isPremium && <span className="lb-premium-badge" title="StreamCards+">&#11088;</span>}
                      {player.isStreamer && <span className="lb-streamer-tag">STREAMER</span>}
                    </span>
                    <span className="lb-player-username">@{player.username}</span>
                  </div>
                </div>
                <div className="lb-score">
                  <span className="lb-score-value">{formatScore(player.score, category)}</span>
                  <span className="lb-score-unit">{getScoreUnit(category)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Leaderboard;
