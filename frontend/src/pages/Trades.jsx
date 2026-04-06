import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import CardPreview from '../components/CardPreview';
import './Trades.css';

export default function Trades({ onBack, currentUserId }) {
  const toast = useToast();
  const [tab, setTab] = useState('received');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTrade, setShowNewTrade] = useState(false);

  useEffect(() => { loadTrades(); }, []);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const data = await api.getTrades();
      setTrades(data.trades || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (tradeId) => {
    try {
      await api.acceptTrade(tradeId);
      toast.success('Echange accepte !');
      loadTrades();
    } catch (e) { toast.error(e.message); }
  };

  const handleDecline = async (tradeId) => {
    try {
      await api.declineTrade(tradeId);
      toast.success('Echange refuse');
      loadTrades();
    } catch (e) { toast.error(e.message); }
  };

  const handleCancel = async (tradeId) => {
    try {
      await api.cancelTrade(tradeId);
      toast.success('Echange annule');
      loadTrades();
    } catch (e) { toast.error(e.message); }
  };

  const received = trades.filter(t => t.receiver_id === currentUserId && t.status === 'pending');
  const sent = trades.filter(t => t.sender_id === currentUserId && t.status === 'pending');
  const history = trades.filter(t => t.status !== 'pending');

  const displayTrades = tab === 'received' ? received : tab === 'sent' ? sent : history;

  return (
    <div className="trades-page">
      <div className="trades-header">
        <button className="trades-back" onClick={onBack}>&larr;</button>
        <h2>Echanges</h2>
        <button className="trades-new-btn" onClick={() => setShowNewTrade(true)}>
          + Nouvel echange
        </button>
      </div>

      <div className="trades-tabs">
        <button className={`trades-tab${tab === 'received' ? ' active' : ''}`} onClick={() => setTab('received')}>
          Recus {received.length > 0 && <span className="trades-tab-badge">{received.length}</span>}
        </button>
        <button className={`trades-tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>
          Envoyes {sent.length > 0 && <span className="trades-tab-badge">{sent.length}</span>}
        </button>
        <button className={`trades-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Historique
        </button>
      </div>

      {loading ? (
        <div className="trades-loading">
          {[1,2,3].map(i => <div key={i} className="trade-skeleton shimmer" />)}
        </div>
      ) : displayTrades.length === 0 ? (
        <div className="trades-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M14 14l7 7M3 8V3h5M10 10L3 3"/>
          </svg>
          <p>{tab === 'received' ? 'Aucun echange recu' : tab === 'sent' ? 'Aucun echange en attente' : 'Aucun historique'}</p>
        </div>
      ) : (
        <div className="trades-list">
          {displayTrades.map(trade => (
            <TradeCard
              key={trade.id}
              trade={trade}
              currentUserId={currentUserId}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {showNewTrade && (
        <NewTradeModal
          currentUserId={currentUserId}
          onClose={() => setShowNewTrade(false)}
          onCreated={() => { setShowNewTrade(false); loadTrades(); toast.success('Offre envoyee !'); }}
        />
      )}
    </div>
  );
}

function TradeCard({ trade, currentUserId, onAccept, onDecline, onCancel }) {
  const isSender = trade.sender_id === currentUserId;
  const otherName = isSender ? trade.receiver_name : trade.sender_name;
  const otherImage = isSender ? trade.receiver_image : trade.sender_image;

  const senderItems = trade.items.filter(i => i.user_id === trade.sender_id);
  const receiverItems = trade.items.filter(i => i.user_id === trade.receiver_id);

  const myItems = isSender ? senderItems : receiverItems;
  const theirItems = isSender ? receiverItems : senderItems;

  const statusLabels = { pending: 'En attente', accepted: 'Accepte', declined: 'Refuse', cancelled: 'Annule' };
  const statusClass = trade.status;

  return (
    <div className={`trade-card trade-${statusClass}`}>
      <div className="trade-card-header">
        <div className="trade-partner">
          {otherImage && <img src={otherImage} alt="" className="trade-partner-img" />}
          <span>{otherName}</span>
        </div>
        <span className={`trade-status trade-status-${statusClass}`}>{statusLabels[trade.status]}</span>
      </div>

      <div className="trade-card-body">
        <div className="trade-side">
          <div className="trade-side-label">{isSender ? 'Vous proposez' : 'Propose'}</div>
          <div className="trade-cards-row">
            {(isSender ? senderItems : senderItems).map(item => (
              <div key={item.user_card_id} className="trade-mini-card">
                <CardPreview card={item} size="tiny" />
                <span className="trade-mini-name">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="trade-arrow">&#8644;</div>
        <div className="trade-side">
          <div className="trade-side-label">{isSender ? 'En echange de' : 'Demande'}</div>
          <div className="trade-cards-row">
            {(isSender ? receiverItems : receiverItems).map(item => (
              <div key={item.user_card_id} className="trade-mini-card">
                <CardPreview card={item} size="tiny" />
                <span className="trade-mini-name">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {trade.message && <div className="trade-message">"{trade.message}"</div>}

      {trade.status === 'pending' && (
        <div className="trade-actions">
          {!isSender && (
            <>
              <button className="trade-accept-btn" onClick={() => onAccept(trade.id)}>Accepter</button>
              <button className="trade-decline-btn" onClick={() => onDecline(trade.id)}>Refuser</button>
            </>
          )}
          {isSender && (
            <button className="trade-cancel-btn" onClick={() => onCancel(trade.id)}>Annuler</button>
          )}
        </div>
      )}

      <div className="trade-date">{new Date(trade.created_at).toLocaleDateString('fr-FR')}</div>
    </div>
  );
}

function NewTradeModal({ currentUserId, onClose, onCreated }) {
  const toast = useToast();
  const [step, setStep] = useState(1); // 1: pick user, 2: pick cards, 3: confirm
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [theirCards, setTheirCards] = useState([]);
  const [selectedMyCards, setSelectedMyCards] = useState([]);
  const [selectedTheirCards, setSelectedTheirCards] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const data = await api.searchUsers(q);
      setSearchResults(data.users || []);
    } catch {}
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setStep(2);
    try {
      const [mine, theirs] = await Promise.all([
        api.getUserCards(),
        api.getOtherUserCards(user.twitch_id),
      ]);
      setMyCards(mine.cards || []);
      setTheirCards(theirs.cards || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleMyCard = (id) => {
    setSelectedMyCards(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 10 ? [...prev, id] : prev
    );
  };

  const toggleTheirCard = (id) => {
    setSelectedTheirCards(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 10 ? [...prev, id] : prev
    );
  };

  const handleSend = async () => {
    if (selectedMyCards.length === 0 || selectedTheirCards.length === 0) {
      toast.error('Selectionnez des cartes des deux cotes');
      return;
    }
    setSending(true);
    try {
      await api.createTrade(selectedUser.twitch_id, selectedMyCards, selectedTheirCards, message || undefined);
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal" onClick={e => e.stopPropagation()}>
        <button className="trade-modal-close" onClick={onClose}>&times;</button>
        <h3>Nouvel echange</h3>

        {step === 1 && (
          <div className="trade-step">
            <p className="trade-step-label">Rechercher un joueur</p>
            <input
              type="text"
              className="trade-search-input"
              placeholder="Nom du joueur..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
            />
            <div className="trade-search-results">
              {searchResults.map(u => (
                <div key={u.twitch_id} className="trade-user-result" onClick={() => handleSelectUser(u)}>
                  {u.profile_image_url && <img src={u.profile_image_url} alt="" />}
                  <span>{u.display_name || u.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedUser && (
          <div className="trade-step">
            <div className="trade-partner-selected">
              Echange avec <strong>{selectedUser.display_name || selectedUser.username}</strong>
            </div>

            <div className="trade-card-picker">
              <div className="trade-picker-side">
                <h4>Vos cartes ({selectedMyCards.length})</h4>
                <div className="trade-picker-grid">
                  {myCards.map(c => (
                    <div
                      key={c.id}
                      className={`trade-picker-card${selectedMyCards.includes(c.id) ? ' selected' : ''}`}
                      onClick={() => toggleMyCard(c.id)}
                    >
                      <CardPreview card={c} size="tiny" />
                      <span>{c.name}</span>
                    </div>
                  ))}
                  {myCards.length === 0 && <p className="trade-picker-empty">Aucune carte</p>}
                </div>
              </div>

              <div className="trade-picker-arrow">&#8644;</div>

              <div className="trade-picker-side">
                <h4>Ses cartes ({selectedTheirCards.length})</h4>
                <div className="trade-picker-grid">
                  {theirCards.map(c => (
                    <div
                      key={c.id}
                      className={`trade-picker-card${selectedTheirCards.includes(c.id) ? ' selected' : ''}`}
                      onClick={() => toggleTheirCard(c.id)}
                    >
                      <CardPreview card={c} size="tiny" />
                      <span>{c.name}</span>
                    </div>
                  ))}
                  {theirCards.length === 0 && <p className="trade-picker-empty">Aucune carte</p>}
                </div>
              </div>
            </div>

            <textarea
              className="trade-message-input"
              placeholder="Message (optionnel)..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={200}
            />

            <div className="trade-modal-actions">
              <button className="trade-modal-back" onClick={() => setStep(1)}>Retour</button>
              <button
                className="trade-modal-send"
                onClick={handleSend}
                disabled={sending || selectedMyCards.length === 0 || selectedTheirCards.length === 0}
              >
                {sending ? 'Envoi...' : 'Envoyer l\'offre'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
