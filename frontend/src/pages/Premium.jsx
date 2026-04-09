import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import './Premium.css';

const VIEWER_PERKS = [
  { icon: '\uD83D\uDCB0', label: '+100 coins bonus par jour', desc: 'En plus de la recompense quotidienne de base' },
  { icon: '\u2B50', label: 'Badge Premium', desc: 'Visible sur votre profil et le classement' },
  { icon: '\uD83D\uDDBC\uFE0F', label: '7 slots showcase', desc: 'Au lieu de 5 sur votre profil' },
  { icon: '\uD83C\uDFA8', label: 'Bordure de profil animee', desc: 'Effet cosmetique exclusif' },
];

const STREAMER_TIERS_INFO = [
  { tier: 'small', viewers: '< 50', price: '3' },
  { tier: 'medium', viewers: '50 - 200', price: '7' },
  { tier: 'large', viewers: '200 - 500', price: '12' },
  { tier: 'enterprise', viewers: '500+', price: '20' },
];

const STREAMER_PERKS = [
  { icon: '\uD83D\uDCE6', label: 'Packs illimites', desc: 'Au lieu de 3 max en gratuit' },
  { icon: '\uD83C\uDCCF', label: '30 cartes par pack', desc: 'Au lieu de 15 en gratuit' },
  { icon: '\u2728', label: '13 effets de carte', desc: 'Holographic, prismatic, aurora, galaxy...' },
  { icon: '\uD83C\uDFA8', label: 'Personnalisation complete', desc: 'Couleurs de pack et d\'effets de carte' },
  { icon: '\uD83D\uDCCA', label: 'Analytics avances', desc: 'Popularite, distribution, activite recente' },
];

function Premium({ onBack, user }) {
  const [subStatus, setSubStatus] = useState(null);
  const [streamerTier, setStreamerTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const status = await api.getSubscriptionStatus();
        setSubStatus(status);
        if (user?.isStreamer) {
          try {
            const tier = await api.getStreamerTier();
            setStreamerTier(tier);
          } catch { /* ignore if tier calc fails */ }
        }
      } catch (err) {
        console.error('Error loading subscription:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleCheckout = async (type) => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const result = await api.createCheckout(type);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    try {
      const result = await api.getPortalUrl();
      if (result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="premium-page">
        <div className="lb-loading"><div className="loading-spinner"></div><p>Chargement...</p></div>
      </div>
    );
  }

  const isActive = subStatus?.isPremium;
  const currentType = subStatus?.subscriptionType;

  return (
    <div className="premium-page">
      {onBack && <button className="premium-back-btn" onClick={onBack}>&larr; Retour</button>}

      <div className="premium-hero">
        <h1 className="premium-title">StreamCards<span className="premium-plus">+</span></h1>
        <p className="premium-subtitle">
          Debloquez des avantages exclusifs pour enrichir votre experience
        </p>
      </div>

      {/* Current status */}
      {isActive && (
        <div className="premium-status-banner">
          <span className="premium-status-icon">\u2705</span>
          <div>
            <strong>Abonnement actif</strong> — {currentType === 'viewer_premium' ? 'Viewer Premium' : 'Streamer Premium'}
          </div>
          <button className="premium-manage-btn" onClick={handleManage}>
            Gerer mon abonnement
          </button>
        </div>
      )}

      {/* Viewer Premium Card */}
      <div className="premium-plans">
        <div className={`premium-plan-card ${currentType === 'viewer_premium' ? 'plan-active' : ''}`}>
          <div className="plan-header">
            <h2 className="plan-name">Viewer Premium</h2>
            <div className="plan-price">
              <span className="plan-amount">2.99</span>
              <span className="plan-currency">EUR/mois</span>
            </div>
          </div>
          <p className="plan-desc">Avantages cosmetiques et bonus quotidiens pour les collectionneurs</p>
          <ul className="plan-perks">
            {VIEWER_PERKS.map((perk, i) => (
              <li key={i} className="plan-perk">
                <span className="perk-icon">{perk.icon}</span>
                <div>
                  <strong>{perk.label}</strong>
                  <span className="perk-desc">{perk.desc}</span>
                </div>
              </li>
            ))}
          </ul>
          {currentType === 'viewer_premium' ? (
            <button className="plan-btn plan-btn-active" disabled>Abonnement actif</button>
          ) : (
            <button
              className="plan-btn plan-btn-viewer"
              onClick={() => handleCheckout('viewer_premium')}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirection...' : 'S\'abonner'}
            </button>
          )}
        </div>

        {/* Streamer Premium Card */}
        {user?.isStreamer && (
          <div className={`premium-plan-card plan-streamer ${currentType === 'streamer_premium' ? 'plan-active' : ''}`}>
            <div className="plan-header">
              <h2 className="plan-name">Streamer Premium</h2>
              <div className="plan-price">
                {streamerTier ? (
                  <>
                    <span className="plan-amount">{(streamerTier.priceCents / 100).toFixed(2)}</span>
                    <span className="plan-currency">EUR/mois</span>
                  </>
                ) : (
                  <span className="plan-amount-range">3 - 20 EUR/mois</span>
                )}
              </div>
              {streamerTier && (
                <div className="plan-tier-badge">{streamerTier.label}</div>
              )}
            </div>
            <p className="plan-desc">Outils avances de creation + tous les avantages Viewer Premium inclus</p>
            <ul className="plan-perks">
              {STREAMER_PERKS.map((perk, i) => (
                <li key={i} className="plan-perk">
                  <span className="perk-icon">{perk.icon}</span>
                  <div>
                    <strong>{perk.label}</strong>
                    <span className="perk-desc">{perk.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
            {currentType === 'streamer_premium' ? (
              <button className="plan-btn plan-btn-active" disabled>Abonnement actif</button>
            ) : (
              <button
                className="plan-btn plan-btn-streamer"
                onClick={() => handleCheckout('streamer_premium')}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? 'Redirection...' : 'S\'abonner'}
              </button>
            )}

            {/* Tier pricing table */}
            <div className="plan-tiers">
              <h4>Pricing equitable</h4>
              <p className="plan-tiers-desc">Le prix est adapte a la taille de votre chaine</p>
              <table className="tiers-table">
                <thead>
                  <tr>
                    <th>Viewers moyens</th>
                    <th>Prix/mois</th>
                  </tr>
                </thead>
                <tbody>
                  {STREAMER_TIERS_INFO.map(t => (
                    <tr key={t.tier} className={streamerTier?.tier === t.tier ? 'tier-current' : ''}>
                      <td>{t.viewers}</td>
                      <td>{t.price} EUR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="premium-faq">
        <h3>Questions frequentes</h3>
        <div className="faq-item">
          <strong>Puis-je annuler a tout moment ?</strong>
          <p>Oui, vous pouvez annuler votre abonnement a tout moment depuis le portail de gestion. Vous conservez vos avantages jusqu'a la fin de la periode payee.</p>
        </div>
        <div className="faq-item">
          <strong>Les coins sont-ils vendus ?</strong>
          <p>Non. Les coins restent 100% gratuits et s'obtiennent via les recompenses quotidiennes, les quetes et les Channel Points Twitch. L'abonnement offre des bonus, pas un achat de monnaie.</p>
        </div>
        <div className="faq-item">
          <strong>Que se passe-t-il si mon abonnement expire ?</strong>
          <p>Vos cartes et packs existants sont conserves. Vous perdez les avantages premium (bonus coins, effets avances, slots supplementaires) mais tout votre contenu reste intact.</p>
        </div>
        <div className="faq-item">
          <strong>Le Streamer Premium inclut-il le Viewer Premium ?</strong>
          <p>Oui, tous les avantages Viewer Premium sont inclus dans l'abonnement Streamer Premium.</p>
        </div>
      </div>
    </div>
  );
}

export default Premium;
