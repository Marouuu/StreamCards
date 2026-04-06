// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  // Health check
  health: () => fetch(`${API_BASE_URL}/health`).then(res => res.json()),
  
  // Auth
  twitchLogin: () => `${API_BASE_URL}/auth/twitch`,
  getCurrentUser: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) {
      console.log('No token in localStorage');
      return null;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Auth response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth error:', errorText);
        return null;
      }
      
      const data = await response.json();
      console.log('Auth data:', data);
      return data;
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  },
  
  // Cards
  getStreamerCards: (streamerId) => `${API_BASE_URL}/cards/streamer/${streamerId}`,
  getUserCollection: (userId) => `${API_BASE_URL}/cards/collection/${userId}`,
  
  // Shop
  getBoosters: () => `${API_BASE_URL}/shop/boosters`,
  purchaseBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/purchase`,
  openBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/open`,
  
  // Pack Management
  getMyPacks: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) return [];
    const res = await fetch(`${API_BASE_URL}/packs`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.packs || [];
  },

  createPack: async (packData) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(packData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create pack');
    }
    return (await res.json()).pack;
  },

  updatePack: async (id, packData) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(packData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update pack');
    }
    return (await res.json()).pack;
  },

  deletePack: async (id) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete pack');
    }
    return true;
  },

  getPackWithCards: async (packId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${packId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch pack');
    return await res.json();
  },

  // Card management (within a booster pack)
  getPackCards: async (packId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) return [];
    const res = await fetch(`${API_BASE_URL}/packs/${packId}/cards`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return (await res.json()).cards || [];
  },

  createCard: async (packId, cardData) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${packId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(cardData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create card');
    }
    return (await res.json()).card;
  },

  updateCard: async (packId, cardId, cardData) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${packId}/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(cardData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update card');
    }
    return (await res.json()).card;
  },

  deleteCard: async (packId, cardId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/packs/${packId}/cards/${cardId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete card');
    }
    return true;
  },

  // User
  addCoins: async (amount = 1000000) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await fetch(`${API_BASE_URL}/user/add-coins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add coins');
    }
    
    const data = await response.json();
    // Update token in localStorage
    if (data.newToken) {
      localStorage.setItem('streamcards_token', data.newToken);
    }
    
    return data;
  },
  // Recycle a single duplicate card
  recycleCard: async (cardId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/cards/recycle/${cardId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to recycle card');
    }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },

  // Request streamer status
  requestStreamer: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/user/request-streamer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to request streamer status');
    }
    return await res.json();
  },

  // Get streamer status
  getStreamerStatus: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/user/streamer-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  },

  // Admin: get pending streamer requests
  getStreamerRequests: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/streamer-requests`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch requests');
    }
    return await res.json();
  },

  // Admin: get all users
  getAdminUsers: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch users');
    }
    return await res.json();
  },

  // Admin: approve streamer
  approveStreamer: async (twitchId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/approve-streamer/${twitchId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve streamer');
    }
    return await res.json();
  },

  // Admin: reject streamer
  rejectStreamer: async (twitchId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/reject-streamer/${twitchId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reject streamer');
    }
    return await res.json();
  },

  // Admin: get pending packs
  getPendingPacks: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/pending-packs`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: approve pack
  approvePack: async (packId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/approve-pack/${packId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: reject pack
  rejectPack: async (packId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/reject-pack/${packId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: get pending cards
  getPendingCards: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/pending-cards`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: approve card
  approveCard: async (cardId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/approve-card/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: reject card
  rejectCard: async (cardId, note) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/reject-card/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Admin: get stats
  getAdminStats: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  },

  // Marketplace: browse listings
  getMarketplaceListings: async (params = {}) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/marketplace${qs ? '?' + qs : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Marketplace: my listings
  getMyListings: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/marketplace/my-listings`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Marketplace: list a card for sale
  listCard: async (userCardId, price) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/marketplace/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ userCardId, price }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Marketplace: buy a card
  buyCard: async (listingId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/marketplace/buy/${listingId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },

  // Marketplace: cancel listing
  cancelListing: async (listingId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/marketplace/cancel/${listingId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Rewards
  getRewards: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/rewards`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  claimDaily: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/rewards/claim-daily`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },

  claimQuest: async (questId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/rewards/claim-quest/${questId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },

  // Leaderboard
  getLeaderboard: async (category = 'collection') => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/leaderboard?category=${category}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Trades
  getTrades: async (status) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE_URL}/trades${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  createTrade: async (receiverId, senderCardIds, receiverCardIds, message) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ receiverId, senderCardIds, receiverCardIds, message }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  acceptTrade: async (tradeId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/trades/${tradeId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  declineTrade: async (tradeId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/trades/${tradeId}/decline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  cancelTrade: async (tradeId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/trades/${tradeId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // User search
  searchUsers: async (q) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/user/search?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return { users: [] };
    return await res.json();
  },

  // Notifications
  getNotifications: async (unreadOnly = false) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const res = await fetch(`${API_BASE_URL}/notifications${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  markNotificationRead: async (id) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  markAllNotificationsRead: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  // Profile
  getProfile: async (userId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/profile/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      let msg = 'Failed to load profile';
      try { const err = await res.json(); msg = err.error || msg; } catch {}
      throw new Error(msg);
    }
    return await res.json();
  },

  updateShowcase: async (cards) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/profile/showcase`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ cards }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  updateBio: async (bio) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/profile/bio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ bio }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Collection Progress
  getCollectionProgress: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/collection-progress`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  getCreatorProgress: async (creatorId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/collection-progress/${creatorId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  claimCollectionReward: async (rewardId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/collection-progress/${rewardId}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },

  // Pack History
  getPackHistory: async (page = 1) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/history?page=${page}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  getOpeningDetail: async (openingId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/history/${openingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Get user's cards (for trade card picker)
  getUserCards: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/cards/collection/${encodeURIComponent('me')}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Get another user's cards (for requesting in trade)
  getOtherUserCards: async (userId) => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/cards/collection/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Achievements
  getAchievements: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/achievements`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  checkAchievements: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/achievements/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  getUserAchievements: async (userId) => {
    const res = await fetch(`${API_BASE_URL}/achievements/user/${userId}`);
    if (!res.ok) return { achievements: [] };
    return await res.json();
  },

  // Streamer Analytics
  getAnalytics: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    return await res.json();
  },

  // Recycle all duplicates at once
  recycleAll: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/cards/recycle-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to recycle cards');
    }
    const data = await res.json();
    if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
    return data;
  },
};

export default api;

