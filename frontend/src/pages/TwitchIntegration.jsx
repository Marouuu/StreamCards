import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import './TwitchIntegration.css';

function TwitchIntegration({ onBack, isAdmin }) {
  const [config, setConfig] = useState(null);
  const [hasScope, setHasScope] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [redemptions, setRedemptions] = useState([]);

  // Form state
  const [rewardTitle, setRewardTitle] = useState('StreamCards Coins');
  const [channelPointsCost, setChannelPointsCost] = useState(1000);
  const [coinsPerRedeem, setCoinsPerRedeem] = useState(100);

  const toast = useToast();

  useEffect(() => {
    loadConfig();
    loadRedemptions();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await api.getTwitchRewardConfig();
      setConfig(data.config);
      setHasScope(data.hasRequiredScope);
      if (data.config) {
        setRewardTitle(data.config.reward_title || 'StreamCards Coins');
        setChannelPointsCost(data.config.channel_points_cost || 1000);
        setCoinsPerRedeem(data.config.coins_per_redeem || 100);
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRedemptions = async () => {
    try {
      const data = await api.getTwitchRedemptionLog(20);
      setRedemptions(data.redemptions || []);
    } catch {}
  };

  const handleEnable = async () => {
    setSaving(true);
    try {
      const result = await api.updateTwitchRewardConfig({
        rewardTitle,
        channelPointsCost,
        coinsPerRedeem,
        enable: true,
      });

      if (result.needsReauth) {
        // Redirect to Twitch for scope upgrade
        toast.info('Redirection vers Twitch pour autoriser les Channel Points...');
        setTimeout(() => {
          window.location.href = result.authUrl;
        }, 1000);
        return;
      }

      if (result.config) {
        setConfig(result.config);
        setHasScope(true);
        toast.success('Integration activee ! La recompense a ete creee sur votre chaine.');
        loadRedemptions();
      }
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'activation');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const result = await api.updateTwitchRewardConfig({
        rewardTitle,
        channelPointsCost,
        coinsPerRedeem,
        enable: false,
      });
      if (result.config) {
        setConfig(result.config);
        toast.success('Parametres sauvegardes');
      }
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setDeleting(true);
    try {
      await api.deleteTwitchRewardConfig();
      setConfig(null);
      toast.info('Integration desactivee');
      setRedemptions([]);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la desactivation');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestRedeem = async () => {
    setTesting(true);
    try {
      const result = await api.testTwitchRedeem();
      toast.success(`+${result.coinsGranted} coins credites a ${result.viewer} (solde: ${result.newBalance})`);
      loadRedemptions();
    } catch (err) {
      toast.error(err.message || 'Erreur lors du test');
    } finally {
      setTesting(false);
    }
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'A l\'instant';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}j`;
  };

  if (loading) {
    return (
      <div className="twitch-integration">
        <div className="twitch-header">
          <button className="twitch-back-btn" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1>Twitch Integration</h1>
        </div>
        <div className="twitch-loading">Chargement...</div>
      </div>
    );
  }

  const isEnabled = config?.is_enabled;

  return (
    <div className="twitch-integration">
      <div className="twitch-header">
        <button className="twitch-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>Twitch Integration</h1>
      </div>

      {/* Status banner */}
      <div className={`twitch-status ${isEnabled ? 'active' : 'inactive'}`}>
        <div className="twitch-status-dot" />
        <span>{isEnabled ? 'Integration active' : 'Integration inactive'}</span>
        {isEnabled && config?.reward_title && (
          <span className="twitch-status-detail">
            Recompense: "{config.reward_title}" — {config.coins_per_redeem} coins pour {config.channel_points_cost} CP
          </span>
        )}
      </div>

      {/* Explanation */}
      <div className="twitch-explainer">
        <div className="twitch-explainer-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#9146FF">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
        </div>
        <div>
          <h3>Channel Points → StreamCards Coins</h3>
          <p>
            Vos viewers peuvent echanger leurs points de chaine Twitch contre des coins StreamCards.
            Une recompense personnalisee sera creee automatiquement sur votre chaine.
          </p>
        </div>
      </div>

      {/* Configuration form */}
      <div className="twitch-config-card">
        <h2>Configuration</h2>

        <div className="twitch-form-group">
          <label>Nom de la recompense sur Twitch</label>
          <input
            type="text"
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
            maxLength={45}
            placeholder="StreamCards Coins"
            className="twitch-input"
            disabled={isEnabled}
          />
        </div>

        <div className="twitch-form-row">
          <div className="twitch-form-group">
            <label>Cout en Channel Points</label>
            <input
              type="number"
              value={channelPointsCost}
              onChange={(e) => setChannelPointsCost(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={1000000}
              className="twitch-input"
              disabled={isEnabled}
            />
            <span className="twitch-form-hint">Points Twitch necessaires</span>
          </div>

          <div className="twitch-form-group">
            <label>Coins StreamCards donnes</label>
            <input
              type="number"
              value={coinsPerRedeem}
              onChange={(e) => setCoinsPerRedeem(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100000}
              className="twitch-input"
              disabled={isEnabled}
            />
            <span className="twitch-form-hint">Coins recus par le viewer</span>
          </div>
        </div>

        <div className="twitch-form-actions">
          {!isEnabled ? (
            <>
              <button
                className="twitch-btn twitch-btn--primary"
                onClick={handleEnable}
                disabled={saving}
              >
                {saving ? 'Activation...' : 'Activer l\'integration'}
              </button>
              {config && (
                <button
                  className="twitch-btn twitch-btn--secondary"
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  Sauvegarder
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="twitch-btn twitch-btn--danger"
                onClick={handleDisable}
                disabled={deleting}
              >
                {deleting ? 'Desactivation...' : 'Desactiver l\'integration'}
              </button>
              {isAdmin && (
                <button
                  className="twitch-btn twitch-btn--secondary"
                  onClick={handleTestRedeem}
                  disabled={testing}
                >
                  {testing ? 'Test...' : 'Simuler un redeem'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent redemptions */}
      {redemptions.length > 0 && (
        <div className="twitch-redemptions">
          <h2>Dernieres utilisations</h2>
          <div className="twitch-redemptions-list">
            {redemptions.map(r => (
              <div key={r.id} className="twitch-redemption-item">
                {r.viewer_image && <img src={r.viewer_image} alt="" className="twitch-redemption-avatar" />}
                <div className="twitch-redemption-info">
                  <span className="twitch-redemption-name">{r.viewer_name || r.viewer_twitch_id}</span>
                  <span className="twitch-redemption-coins">+{r.coins_granted} coins</span>
                </div>
                <span className="twitch-redemption-time">{timeAgo(r.processed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help section */}
      <div className="twitch-help">
        <h3>Comment ca marche ?</h3>
        <ol>
          <li>Configurez le nombre de coins et le cout en Channel Points</li>
          <li>Cliquez sur "Activer" — une recompense sera creee sur votre chaine Twitch</li>
          <li>Vos viewers utilisent leurs Channel Points pour obtenir des coins StreamCards</li>
          <li>Les coins sont credites automatiquement sur leur compte</li>
        </ol>
      </div>
    </div>
  );
}

export default TwitchIntegration;
