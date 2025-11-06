// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  // Health check
  health: () => fetch(`${API_BASE_URL}/health`).then(res => res.json()),
  
  // Auth
  twitchLogin: () => `${API_BASE_URL}/auth/twitch`,
  twitchCallback: (code) => `${API_BASE_URL}/auth/twitch/callback?code=${code}`,
  
  // Cards
  getStreamerCards: (streamerId) => `${API_BASE_URL}/cards/streamer/${streamerId}`,
  getUserCollection: (userId) => `${API_BASE_URL}/cards/collection/${userId}`,
  
  // Shop
  getBoosters: () => `${API_BASE_URL}/shop/boosters`,
  purchaseBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/purchase`,
  openBooster: (boosterId) => `${API_BASE_URL}/shop/boosters/${boosterId}/open`,
};

export default api;

