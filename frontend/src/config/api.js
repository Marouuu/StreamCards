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
};

export default api;

