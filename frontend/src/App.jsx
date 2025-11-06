import { useState, useEffect } from 'react'
import './App.css'
import Background3D from './components/Background3D'
import Dashboard from './pages/Dashboard'
import { api } from './config/api'
import { getToken, setToken, removeToken } from './utils/auth'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for OAuth callback token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const error = urlParams.get('error')
    const success = urlParams.get('success')

    console.log('App useEffect - URL params:', { token: token ? 'present' : 'missing', error, success })

    if (token) {
      console.log('Token found in URL, storing it...')
      setToken(token)
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname)
      // Fetch user info
      fetchUser()
    } else if (error) {
      console.error('OAuth error:', error)
      alert(`Login failed: ${error}`)
      window.history.replaceState({}, document.title, window.location.pathname)
      setLoading(false)
    } else {
      // Check if user is already logged in
      console.log('No token in URL, checking existing token...')
      fetchUser()
    }
  }, [])

  const fetchUser = async () => {
    try {
      const token = getToken()
      if (!token) {
        console.log('No token found')
        setLoading(false)
        return
      }

      console.log('Fetching user with token:', token.substring(0, 20) + '...')
      const userData = await api.getCurrentUser()
      console.log('User data received:', userData)
      
      if (userData) {
        setUser(userData)
      } else {
        console.error('No user data returned')
        // Invalid token, remove it
        removeToken()
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      removeToken()
    } finally {
      setLoading(false)
    }
  }

  const handleTwitchLogin = () => {
    window.location.href = api.twitchLogin()
  }

  const handleLogout = () => {
    removeToken()
    setUser(null)
  }

  return (
    <div className="app">
      <Background3D />
      <header className="app-header">
        <h1>🎴 StreamCards</h1>
        <nav>
          {loading ? (
            <span>Loading...</span>
          ) : user ? (
            <div className="user-info">
              {user.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt={user.displayName || user.username}
                  className="user-avatar"
                />
              )}
              <span>Welcome, {user.displayName || user.username}!</span>
              <button className="coins-btn">
                💰 {user.coins || 0}
              </button>
              <button className="shop-btn">
                🛒 SHOP
              </button>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          ) : (
            <button className="twitch-login-btn" onClick={handleTwitchLogin}>
              Connect Twitch
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
        {user ? (
          <Dashboard />
        ) : (
          <>
            <section className="hero">
              <h2>Collect Cards from Your Favorite Streamers</h2>
              <p>Earn Twitch Coins and unlock exclusive booster packs!</p>
            </section>

            <section className="features">
              <div className="feature-card">
                <h3>🎮 Connect with Twitch</h3>
                <p>Link your Twitch account to start collecting</p>
              </div>
              <div className="feature-card">
                <h3>💰 Earn Coins</h3>
                <p>Claim Twitch Channel Points to earn coins</p>
              </div>
              <div className="feature-card">
                <h3>📦 Open Boosters</h3>
                <p>Purchase and open booster packs with different rarities</p>
              </div>
              <div className="feature-card">
                <h3>🎴 Build Your Collection</h3>
                <p>Collect cards from all streamers on the platform</p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
