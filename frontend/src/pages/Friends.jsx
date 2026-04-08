import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import './Friends.css';

function Friends({ onBack, currentUserId }) {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [activities, setActivities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatFriend, setChatFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const chatPollRef = useRef(null);
  const toast = useToast();

  const loadFriends = useCallback(async () => {
    try {
      const data = await api.getFriends();
      setFriends(data.friends || []);
      setPendingReceived(data.pendingReceived || []);
      setPendingSent(data.pendingSent || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const data = await api.getUnreadMessages();
      setUnreadCounts(data.unread || {});
    } catch {}
  }, []);

  useEffect(() => {
    loadFriends();
    loadUnread();
  }, [loadFriends, loadUnread]);

  // Load activity feed when tab changes
  useEffect(() => {
    if (tab === 'activity') {
      api.getFriendActivity().then(data => setActivities(data.activities || [])).catch(() => {});
    }
  }, [tab]);

  // Poll messages when in chat
  useEffect(() => {
    if (chatFriend) {
      const loadMessages = async () => {
        try {
          const data = await api.getMessages(chatFriend.twitch_id);
          setMessages(data.messages || []);
          setUnreadCounts(prev => ({ ...prev, [chatFriend.twitch_id]: 0 }));
        } catch {}
      };
      loadMessages();
      chatPollRef.current = setInterval(loadMessages, 5000);
      return () => clearInterval(chatPollRef.current);
    }
  }, [chatFriend]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await api.searchUsers(q);
      setSearchResults(data.users || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handleSendRequest = async (friendId) => {
    try {
      const result = await api.sendFriendRequest(friendId);
      if (result.status === 'accepted') {
        toast.success('Vous etes maintenant amis !');
      } else {
        toast.success('Demande envoyee !');
      }
      loadFriends();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await api.acceptFriendRequest(requestId);
      toast.success('Ami accepte !');
      loadFriends();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await api.declineFriendRequest(requestId);
      loadFriends();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (friendId) => {
    try {
      await api.removeFriend(friendId);
      toast.info('Ami retire');
      loadFriends();
      if (chatFriend?.twitch_id === friendId) setChatFriend(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || sendingMessage || !chatFriend) return;
    setSendingMessage(true);
    try {
      const data = await api.sendMessage(chatFriend.twitch_id, messageInput.trim());
      setMessages(prev => [...prev, data.message]);
      setMessageInput('');
    } catch (err) {
      toast.error(err.message);
    }
    setSendingMessage(false);
  };

  const openChat = (friend) => {
    setChatFriend(friend);
    setTab('chat');
  };

  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0);

  const getActivityIcon = (type) => {
    const icons = {
      pack_opened: '📦', card_obtained: '🎴', trade_completed: '🔄',
      marketplace_sale: '💰', marketplace_purchase: '🛒',
      auction_won: '🔨', achievement_unlocked: '🏆', friend_added: '👥',
    };
    return icons[type] || '📌';
  };

  const getActivityText = (activity) => {
    const name = activity.display_name || activity.username;
    const d = activity.data || {};
    switch (activity.type) {
      case 'pack_opened': return `${name} a ouvert un booster${d.packName ? ` "${d.packName}"` : ''}`;
      case 'card_obtained': return `${name} a obtenu une carte${d.cardName ? ` "${d.cardName}"` : ''}${d.rarity ? ` (${d.rarity})` : ''}`;
      case 'trade_completed': return `${name} a complete un echange`;
      case 'marketplace_sale': return `${name} a vendu une carte${d.price ? ` pour ${d.price} coins` : ''}`;
      case 'marketplace_purchase': return `${name} a achete une carte sur le marche`;
      case 'auction_won': return `${name} a remporte une enchere`;
      case 'achievement_unlocked': return `${name} a debloque un succes${d.achievementName ? ` "${d.achievementName}"` : ''}`;
      case 'friend_added': return `${name} a ajoute un nouvel ami`;
      default: return `${name} a fait quelque chose`;
    }
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'A l\'instant';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}j`;
  };

  // Check if a search result user is already a friend or has a pending request
  const getFriendshipStatus = (userId) => {
    if (friends.some(f => f.twitch_id === userId)) return 'friend';
    if (pendingSent.some(p => p.twitch_id === userId)) return 'pending_sent';
    if (pendingReceived.some(p => p.twitch_id === userId)) return 'pending_received';
    return 'none';
  };

  return (
    <div className="friends-page">
      <div className="friends-header">
        <button className="friends-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1>Amis</h1>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button className={`friends-tab${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>
          Amis {friends.length > 0 && <span className="friends-tab-count">{friends.length}</span>}
        </button>
        <button className={`friends-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>
          Demandes {pendingReceived.length > 0 && <span className="friends-tab-badge">{pendingReceived.length}</span>}
        </button>
        <button className={`friends-tab${tab === 'chat' ? ' active' : ''}`} onClick={() => setTab('chat')}>
          Messages {totalUnread > 0 && <span className="friends-tab-badge">{totalUnread}</span>}
        </button>
        <button className={`friends-tab${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
          Activite
        </button>
      </div>

      {/* Search bar (friends & requests tabs) */}
      {(tab === 'friends' || tab === 'requests') && (
        <div className="friends-search">
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="friends-search-input"
          />
          {searchQuery.length >= 2 && (
            <div className="friends-search-results">
              {searching ? (
                <div className="friends-search-loading">Recherche...</div>
              ) : searchResults.length === 0 ? (
                <div className="friends-search-empty">Aucun resultat</div>
              ) : (
                searchResults.map(user => {
                  const status = getFriendshipStatus(user.twitch_id);
                  return (
                    <div key={user.twitch_id} className="friends-search-item">
                      <img src={user.profile_image_url} alt="" className="friends-avatar" />
                      <span className="friends-name">{user.display_name || user.username}</span>
                      {status === 'none' && (
                        <button className="friends-add-btn" onClick={() => handleSendRequest(user.twitch_id)}>
                          Ajouter
                        </button>
                      )}
                      {status === 'friend' && <span className="friends-status-badge">Ami</span>}
                      {status === 'pending_sent' && <span className="friends-status-badge pending">En attente</span>}
                      {status === 'pending_received' && (
                        <button className="friends-add-btn" onClick={() => {
                          const req = pendingReceived.find(p => p.twitch_id === user.twitch_id);
                          if (req) handleAccept(req.request_id);
                        }}>Accepter</button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <div className="friends-content">
        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          loading ? (
            <div className="friends-loading">Chargement...</div>
          ) : friends.length === 0 ? (
            <div className="friends-empty">
              <div className="friends-empty-icon">👥</div>
              <p>Vous n'avez pas encore d'amis</p>
              <p className="friends-empty-hint">Utilisez la barre de recherche pour trouver des joueurs</p>
            </div>
          ) : (
            <div className="friends-list">
              {friends.map(friend => (
                <div key={friend.twitch_id} className="friend-card">
                  <img src={friend.profile_image_url} alt="" className="friends-avatar" />
                  <div className="friend-info">
                    <span className="friends-name">
                      {friend.display_name || friend.username}
                      {friend.is_streamer && <span className="friends-streamer-badge">Streamer</span>}
                    </span>
                  </div>
                  <div className="friend-actions">
                    <button className="friend-chat-btn" onClick={() => openChat(friend)} title="Envoyer un message">
                      💬
                      {unreadCounts[friend.twitch_id] > 0 && (
                        <span className="friend-unread-dot" />
                      )}
                    </button>
                    <button className="friend-remove-btn" onClick={() => handleRemove(friend.twitch_id)} title="Retirer">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="friends-requests">
            {pendingReceived.length > 0 && (
              <div className="requests-section">
                <h3>Demandes recues</h3>
                {pendingReceived.map(req => (
                  <div key={req.request_id} className="request-card">
                    <img src={req.profile_image_url} alt="" className="friends-avatar" />
                    <span className="friends-name">{req.display_name || req.username}</span>
                    <div className="request-actions">
                      <button className="request-accept-btn" onClick={() => handleAccept(req.request_id)}>Accepter</button>
                      <button className="request-decline-btn" onClick={() => handleDecline(req.request_id)}>Refuser</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingSent.length > 0 && (
              <div className="requests-section">
                <h3>Demandes envoyees</h3>
                {pendingSent.map(req => (
                  <div key={req.request_id} className="request-card">
                    <img src={req.profile_image_url} alt="" className="friends-avatar" />
                    <span className="friends-name">{req.display_name || req.username}</span>
                    <span className="friends-status-badge pending">En attente</span>
                  </div>
                ))}
              </div>
            )}
            {pendingReceived.length === 0 && pendingSent.length === 0 && (
              <div className="friends-empty">
                <div className="friends-empty-icon">📬</div>
                <p>Aucune demande en attente</p>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {tab === 'chat' && (
          chatFriend ? (
            <div className="chat-container">
              <div className="chat-header">
                <button className="chat-back-btn" onClick={() => setChatFriend(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <img src={chatFriend.profile_image_url} alt="" className="chat-avatar" />
                <span className="chat-friend-name">{chatFriend.display_name || chatFriend.username}</span>
              </div>
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">Aucun message. Dites bonjour !</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`chat-msg${msg.sender_id === currentUserId ? ' chat-msg--mine' : ''}`}>
                      <div className="chat-msg-bubble">
                        <p>{msg.content}</p>
                        <span className="chat-msg-time">{timeAgo(msg.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Votre message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  maxLength={1000}
                  autoFocus
                />
                <button type="submit" className="chat-send-btn" disabled={sendingMessage || !messageInput.trim()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </form>
            </div>
          ) : (
            <div className="chat-friend-list">
              {friends.length === 0 ? (
                <div className="friends-empty">
                  <div className="friends-empty-icon">💬</div>
                  <p>Ajoutez des amis pour commencer a chatter</p>
                </div>
              ) : (
                friends.map(friend => (
                  <button key={friend.twitch_id} className="chat-friend-item" onClick={() => openChat(friend)}>
                    <img src={friend.profile_image_url} alt="" className="friends-avatar" />
                    <span className="friends-name">{friend.display_name || friend.username}</span>
                    {unreadCounts[friend.twitch_id] > 0 && (
                      <span className="chat-unread-badge">{unreadCounts[friend.twitch_id]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )
        )}

        {/* ACTIVITY TAB */}
        {tab === 'activity' && (
          activities.length === 0 ? (
            <div className="friends-empty">
              <div className="friends-empty-icon">📰</div>
              <p>Aucune activite recente</p>
              <p className="friends-empty-hint">L'activite de vos amis apparaitra ici</p>
            </div>
          ) : (
            <div className="activity-feed">
              {activities.map(activity => (
                <div key={activity.id} className="activity-item">
                  <img src={activity.profile_image_url} alt="" className="activity-avatar" />
                  <div className="activity-content">
                    <span className="activity-icon">{getActivityIcon(activity.type)}</span>
                    <p className="activity-text">{getActivityText(activity)}</p>
                    <span className="activity-time">{timeAgo(activity.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Friends;
