// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Safe JSON parsing — avoids "unexpected token" when server returns HTML
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}): invalid response`);
  }
}

// Helper for authenticated requests with safe JSON handling
async function authFetch(path, options = {}) {
  const token = localStorage.getItem('streamcards_token');
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (data.newToken) localStorage.setItem('streamcards_token', data.newToken);
  return data;
}

// Same as authFetch but returns null/fallback on error instead of throwing
async function authFetchSafe(path, fallback = null) {
  try {
    return await authFetch(path);
  } catch {
    return fallback;
  }
}

export const api = {
  // Health check
  health: () => fetch(`${API_BASE_URL}/health`).then(r => safeJson(r)),

  // Auth
  twitchLogin: () => `${API_BASE_URL}/auth/twitch`,
  getCurrentUser: async () => {
    const token = localStorage.getItem('streamcards_token');
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await safeJson(res);
    } catch {
      return null;
    }
  },

  // Random cards (public, no auth needed)
  getRandomCards: async (limit = 20) => {
    try {
      const res = await fetch(`${API_BASE_URL}/cards/random?limit=${limit}`);
      const data = await safeJson(res);
      return data.cards || [];
    } catch { return []; }
  },

  // Cards (URL builders — used by Shop/Collection components)
  getStreamerCards: (streamerId) => `${API_BASE_URL}/cards/streamer/${streamerId}`,
  getUserCollection: (userId) => `${API_BASE_URL}/cards/collection/${userId}`,

  // Shop (URL builders)
  getBoosters: () => `${API_BASE_URL}/shop/boosters`,
  purchaseBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/purchase`,
  openBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/open`,

  // Pack Management
  getMyPacks: async () => {
    try {
      const data = await authFetch('/packs');
      return data.packs || [];
    } catch { return []; }
  },
  createPack: async (packData) => {
    const data = await authFetch('/packs', { method: 'POST', body: JSON.stringify(packData) });
    return data.pack;
  },
  updatePack: async (id, packData) => {
    const data = await authFetch(`/packs/${id}`, { method: 'PUT', body: JSON.stringify(packData) });
    return data.pack;
  },
  deletePack: async (id) => {
    await authFetch(`/packs/${id}`, { method: 'DELETE' });
    return true;
  },
  getPackWithCards: (packId) => authFetch(`/packs/${packId}`),

  // Card management (within a booster pack)
  getPackCards: async (packId) => {
    try {
      const data = await authFetch(`/packs/${packId}/cards`);
      return data.cards || [];
    } catch { return []; }
  },
  createCard: async (packId, cardData) => {
    const data = await authFetch(`/packs/${packId}/cards`, { method: 'POST', body: JSON.stringify(cardData) });
    return data.card;
  },
  updateCard: async (packId, cardId, cardData) => {
    const data = await authFetch(`/packs/${packId}/cards/${cardId}`, { method: 'PUT', body: JSON.stringify(cardData) });
    return data.card;
  },
  deleteCard: async (packId, cardId) => {
    await authFetch(`/packs/${packId}/cards/${cardId}`, { method: 'DELETE' });
    return true;
  },

  // User
  addCoins: (amount = 1000000) => authFetch('/user/add-coins', { method: 'POST', body: JSON.stringify({ amount }) }),
  recycleCard: (cardId) => authFetch(`/cards/recycle/${cardId}`, { method: 'POST' }),
  requestStreamer: () => authFetch('/user/request-streamer', { method: 'POST' }),
  getStreamerStatus: () => authFetchSafe('/user/streamer-status'),

  // Admin
  getStreamerRequests: () => authFetch('/admin/streamer-requests'),
  getAdminUsers: () => authFetch('/admin/users'),
  approveStreamer: (twitchId, note) => authFetch(`/admin/approve-streamer/${twitchId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectStreamer: (twitchId, note) => authFetch(`/admin/reject-streamer/${twitchId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  getPendingPacks: () => authFetch('/admin/pending-packs'),
  approvePack: (packId, note) => authFetch(`/admin/approve-pack/${packId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectPack: (packId, note) => authFetch(`/admin/reject-pack/${packId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  getPendingCards: () => authFetch('/admin/pending-cards'),
  approveCard: (cardId, note) => authFetch(`/admin/approve-card/${cardId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectCard: (cardId, note) => authFetch(`/admin/reject-card/${cardId}`, { method: 'POST', body: JSON.stringify({ note }) }),
  getAdminStats: () => authFetchSafe('/admin/stats'),

  // Marketplace
  getMarketplaceListings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return authFetch(`/marketplace${qs ? '?' + qs : ''}`);
  },
  getMyListings: () => authFetch('/marketplace/my-listings'),
  listCard: (userCardId, price) => authFetch('/marketplace/list', { method: 'POST', body: JSON.stringify({ userCardId, price }) }),
  buyCard: (listingId) => authFetch(`/marketplace/buy/${listingId}`, { method: 'POST' }),
  cancelListing: (listingId) => authFetch(`/marketplace/cancel/${listingId}`, { method: 'POST' }),

  // Rewards
  getRewards: () => authFetch('/rewards'),
  claimDaily: () => authFetch('/rewards/claim-daily', { method: 'POST' }),
  claimQuest: (questId) => authFetch(`/rewards/claim-quest/${questId}`, { method: 'POST' }),

  // Leaderboard
  getLeaderboard: (category = 'collection') => authFetch(`/leaderboard?category=${category}`),

  // Trades
  getTrades: (status) => authFetch(`/trades${status ? '?status=' + status : ''}`),
  createTrade: (receiverId, senderCardIds, receiverCardIds, message) =>
    authFetch('/trades', { method: 'POST', body: JSON.stringify({ receiverId, senderCardIds, receiverCardIds, message }) }),
  acceptTrade: (tradeId) => authFetch(`/trades/${tradeId}/accept`, { method: 'POST' }),
  declineTrade: (tradeId) => authFetch(`/trades/${tradeId}/decline`, { method: 'POST' }),
  cancelTrade: (tradeId) => authFetch(`/trades/${tradeId}/cancel`, { method: 'POST' }),

  // User search
  searchUsers: async (q) => {
    try {
      return await authFetch(`/user/search?q=${encodeURIComponent(q)}`);
    } catch { return { users: [] }; }
  },

  // Notifications
  getNotifications: (unreadOnly = false) => authFetch(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`),
  markNotificationRead: (id) => authFetch(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => authFetch('/notifications/read-all', { method: 'POST' }),

  // Profile
  getProfile: (userId) => authFetch(`/profile/${userId}`),
  updateShowcase: (cards) => authFetch('/profile/showcase', { method: 'PUT', body: JSON.stringify({ cards }) }),
  updateBio: (bio) => authFetch('/profile/bio', { method: 'PUT', body: JSON.stringify({ bio }) }),

  // Collection Progress
  getCollectionProgress: () => authFetch('/collection-progress'),
  getCreatorProgress: (creatorId) => authFetch(`/collection-progress/${creatorId}`),
  claimCollectionReward: (rewardId) => authFetch(`/collection-progress/${rewardId}/claim`, { method: 'POST' }),

  // Pack History
  getPackHistory: (page = 1) => authFetch(`/history?page=${page}`),
  getOpeningDetail: (openingId) => authFetch(`/history/${openingId}`),

  // User Cards
  getUserCards: () => authFetch(`/cards/collection/${encodeURIComponent('me')}`),
  getOtherUserCards: (userId) => authFetch(`/cards/collection/${userId}`),

  // Achievements
  getAchievements: () => authFetch('/achievements'),
  checkAchievements: () => authFetch('/achievements/check', { method: 'POST' }),
  getUserAchievements: async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/achievements/user/${userId}`);
      return await safeJson(res);
    } catch { return { achievements: [] }; }
  },

  // Streamer Analytics
  getAnalytics: () => authFetch('/analytics'),

  // Auctions
  getAuctions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return authFetch(`/auctions${qs ? '?' + qs : ''}`);
  },
  getAuction: (id) => authFetch(`/auctions/${id}`),
  getMyAuctions: () => authFetch('/auctions/my'),
  createAuction: (userCardId, startingPrice, durationHours, buyoutPrice) =>
    authFetch('/auctions', { method: 'POST', body: JSON.stringify({ userCardId, startingPrice, durationHours, buyoutPrice: buyoutPrice || undefined }) }),
  placeBid: (auctionId, amount) =>
    authFetch(`/auctions/${auctionId}/bid`, { method: 'POST', body: JSON.stringify({ amount }) }),
  cancelAuction: (auctionId) => authFetch(`/auctions/${auctionId}/cancel`, { method: 'POST' }),

  // Recycle all duplicates
  recycleAll: () => authFetch('/cards/recycle-all', { method: 'POST' }),
};

export default api;
