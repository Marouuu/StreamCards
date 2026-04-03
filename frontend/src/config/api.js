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
};

export default api;

