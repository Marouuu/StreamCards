import { useState, useEffect, useCallback } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import './DailyRewards.css';

function DailyRewards({ onBack, onUserUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimingQuest, setClaimingQuest] = useState(null);
  const [claimAnimation, setClaimAnimation] = useState(null);
  const toast = useToast();

  const loadRewards = useCallback(async () => {
    try {
      const result = await api.getRewards();
      setData(result);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const handleClaimDaily = async () => {
    if (claiming || !data?.dailyClaim?.available) return;
    setClaiming(true);
    try {
      const result = await api.claimDaily();
      setClaimAnimation({ type: 'daily', amount: result.reward, streak: result.streak });
      if (onUserUpdate) {
        const userData = await api.getCurrentUser();
        if (userData) onUserUpdate(userData);
      }
      setTimeout(() => {
        setClaimAnimation(null);
        loadRewards();
      }, 2000);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimQuest = async (questId) => {
    if (claimingQuest) return;
    setClaimingQuest(questId);
    try {
      const result = await api.claimQuest(questId);
      setClaimAnimation({ type: 'quest', amount: result.reward, questId });
      if (onUserUpdate) {
        const userData = await api.getCurrentUser();
        if (userData) onUserUpdate(userData);
      }
      setTimeout(() => {
        setClaimAnimation(null);
        loadRewards();
      }, 1500);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClaimingQuest(null);
    }
  };

  if (loading) {
    return (
      <div className="rewards-page">
        <div className="lb-loading"><div className="loading-spinner"></div><p>Chargement...</p></div>
      </div>
    );
  }

  if (!data) return null;

  const { dailyClaim, quests } = data;
  const completedQuests = quests.filter(q => q.completed && !q.claimed).length;
  const totalQuestReward = quests.filter(q => q.completed && !q.claimed).reduce((s, q) => s + q.reward, 0);

  return (
    <div className="rewards-page">
      {/* Claim animation overlay */}
      {claimAnimation && (
        <div className="claim-overlay">
          <div className="claim-popup">
            <span className="claim-coins-icon">&#128176;</span>
            <span className="claim-amount">+{claimAnimation.amount}</span>
            <span className="claim-label">coins</span>
            {claimAnimation.streak && (
              <span className="claim-streak">Serie: {claimAnimation.streak} jour{claimAnimation.streak > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      <div className="rw-header">
        {onBack && <button className="lb-back-btn" onClick={onBack}>&larr;</button>}
        <h1>Recompenses</h1>
      </div>

      {/* Daily Claim */}
      <div className={`rw-daily-card ${dailyClaim.available ? 'available' : 'claimed'}`}>
        <div className="rw-daily-left">
          <div className="rw-daily-icon">&#127873;</div>
          <div className="rw-daily-info">
            <h2>Recompense Quotidienne</h2>
            <p className="rw-daily-desc">
              Connectez-vous chaque jour pour gagner des coins bonus !
            </p>
            <div className="rw-streak-info">
              <span className="rw-streak-fire">&#128293;</span>
              <span>Serie actuelle: <strong>{dailyClaim.streak} jour{dailyClaim.streak !== 1 ? 's' : ''}</strong></span>
              {dailyClaim.streakBonus > 0 && (
                <span className="rw-streak-bonus">+{dailyClaim.streakBonus} bonus</span>
              )}
            </div>
          </div>
        </div>
        <div className="rw-daily-right">
          <div className="rw-daily-reward">
            <span className="rw-reward-amount">{dailyClaim.reward}</span>
            <span className="rw-reward-label">coins</span>
          </div>
          <button
            className={`rw-claim-btn ${!dailyClaim.available ? 'disabled' : ''}`}
            onClick={handleClaimDaily}
            disabled={!dailyClaim.available || claiming}
          >
            {claiming ? 'Chargement...' : dailyClaim.available ? 'Reclamer !' : 'Deja reclame'}
          </button>
        </div>
      </div>

      {/* Streak preview */}
      <div className="rw-streak-preview">
        <h3>Bonus de serie</h3>
        <div className="rw-streak-bars">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => {
            const bonus = Math.min((day - 1) * 25, 250);
            const isActive = dailyClaim.streak >= day;
            const isCurrent = dailyClaim.streak === day;
            return (
              <div key={day} className={`rw-streak-day ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="rw-streak-day-num">J{day}</div>
                <div className="rw-streak-day-bar">
                  <div className="rw-streak-day-fill" style={{ height: `${((100 + bonus) / 350) * 100}%` }} />
                </div>
                <div className="rw-streak-day-reward">{100 + bonus}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quests */}
      <div className="rw-quests-section">
        <div className="rw-quests-header">
          <h2>Quetes du jour</h2>
          {completedQuests > 0 && (
            <span className="rw-quests-available">{completedQuests} a reclamer ({totalQuestReward} coins)</span>
          )}
        </div>

        <div className="rw-quests-list">
          {quests.map(quest => {
            const progressPct = Math.min((quest.progress / quest.target) * 100, 100);
            return (
              <div key={quest.id} className={`rw-quest-card ${quest.claimed ? 'claimed' : quest.completed ? 'completed' : ''}`}>
                <div className="rw-quest-info">
                  <div className="rw-quest-title">{quest.title}</div>
                  <div className="rw-quest-desc">{quest.description}</div>
                  <div className="rw-quest-progress-bar">
                    <div className="rw-quest-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="rw-quest-progress-text">{quest.progress}/{quest.target}</div>
                </div>
                <div className="rw-quest-reward-section">
                  <div className="rw-quest-reward">
                    <span className="rw-quest-coin-icon">&#128176;</span>
                    <span>{quest.reward}</span>
                  </div>
                  {quest.claimed ? (
                    <span className="rw-quest-done">&#10003;</span>
                  ) : quest.completed ? (
                    <button
                      className="rw-quest-claim-btn"
                      onClick={() => handleClaimQuest(quest.id)}
                      disabled={claimingQuest === quest.id}
                    >
                      {claimingQuest === quest.id ? '...' : 'Reclamer'}
                    </button>
                  ) : (
                    <span className="rw-quest-locked">En cours</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DailyRewards;
