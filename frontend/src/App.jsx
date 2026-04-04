import { useState, useEffect } from 'react'
import './App.css'
import Background3D from './components/Background3D'
import Dashboard from './pages/Dashboard'
import Shop from './pages/Shop'
import PackManager from './pages/PackManager'
import Collection from './pages/Collection'
import AdminPanel from './pages/AdminPanel'
import { api } from './config/api'
import { getToken, setToken, removeToken } from './utils/auth'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  // Check for OAuth callback token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const error = urlParams.get('error')

    if (token) {
      setToken(token)
      window.history.replaceState({}, document.title, window.location.pathname)
      fetchUser()
    } else if (error) {
      console.error('OAuth error:', error)
      alert(`Login failed: ${error}`)
      window.history.replaceState({}, document.title, window.location.pathname)
      setLoading(false)
    } else {
      fetchUser()
    }
  }, [])

  const fetchUser = async () => {
    try {
      const token = getToken()
      if (!token) {
        setLoading(false)
        return
      }

      const userData = await api.getCurrentUser()
      if (userData) {
        setUser(userData)
      } else {
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
    setCurrentPage('dashboard')
  }

  const handleStreamerRequest = async () => {
    try {
      await api.requestStreamer()
      const userData = await api.getCurrentUser()
      if (userData) setUser(userData)
      alert('Votre demande de streamer a ete envoyee ! Un admin va la valider.')
    } catch (error) {
      alert(error.message)
    }
  }

  return (
    <div className="app">
      <Background3D />
      <header className="app-header">
        <h1 className="app-logo" onClick={() => user && setCurrentPage('dashboard')}>
          <span className="logo-icon">&#127924;</span>
          <span className="logo-text">StreamCards</span>
        </h1>
        <nav>
          {loading ? (
            <span className="loading-text">Chargement...</span>
          ) : user ? (
            <div className="user-info">
              {user.profileImageUrl && (
                <img
                  src={user.profileImageUrl}
                  alt={user.displayName || user.username}
                  className="user-avatar"
                />
              )}
              <span className="user-welcome">{user.displayName || user.username}</span>
              <button className="coins-btn">
                <span className="coin-icon">&#128176;</span> {(user.coins || 0).toLocaleString()}
              </button>
              <button className="shop-btn" onClick={() => setCurrentPage('shop')}>
                SHOP
              </button>
              {user.isStreamer && (
                <button className="packs-btn" onClick={() => setCurrentPage('pack-manager')}>
                  MES PACKS
                </button>
              )}
              <button className="collection-btn" onClick={() => setCurrentPage('collection')}>
                COLLECTION
              </button>
              {user.isAdmin && (
                <button className="admin-btn" onClick={() => setCurrentPage('admin')}>
                  ADMIN
                </button>
              )}
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          ) : null}
        </nav>
      </header>

      <main className="app-main">
        {user ? (
          currentPage === 'shop' ? (
            <Shop
              onBack={() => setCurrentPage('dashboard')}
              onUserUpdate={setUser}
            />
          ) : currentPage === 'pack-manager' && user.isStreamer ? (
            <PackManager onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'collection' ? (
            <Collection onBack={() => setCurrentPage('dashboard')} onUserUpdate={setUser} />
          ) : currentPage === 'admin' && user.isAdmin ? (
            <AdminPanel onBack={() => setCurrentPage('dashboard')} />
          ) : (
            <Dashboard
              user={user}
              onStreamerRequest={handleStreamerRequest}
              onUserUpdate={setUser}
            />
          )
        ) : (
          <HeroSection onLogin={handleTwitchLogin} />
        )}
      </main>
    </div>
  )
}

/* ==============================
   HERO SECTION (Landing Page)
   ============================== */
function HeroSection({ onLogin }) {
  const [hoveredRole, setHoveredRole] = useState(null)

  return (
    <div className="hero-section">
      {/* Main hero */}
      <div className="hero-top">
        <div className="hero-badge">La plateforme de cartes Twitch</div>
        <h2 className="hero-title">
          Collectionnez les cartes de vos
          <span className="hero-highlight"> streamers preferes</span>
        </h2>
        <p className="hero-subtitle">
          Gagnez des coins, ouvrez des boosters et construisez la collection ultime.
          Connectez-vous avec Twitch pour commencer.
        </p>
      </div>

      {/* Role choice cards */}
      <div className="hero-roles">
        <div
          className={`role-card role-viewer ${hoveredRole === 'viewer' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredRole('viewer')}
          onMouseLeave={() => setHoveredRole(null)}
        >
          <div className="role-icon-wrapper viewer-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <h3 className="role-title">Viewer</h3>
          <p className="role-desc">
            Collectionnez des cartes, ouvrez des boosters et montrez votre collection.
          </p>
          <ul className="role-perks">
            <li>Achetez des boosters dans le shop</li>
            <li>Collectionnez des cartes de tous les streamers</li>
            <li>Recyclez vos doublons pour des coins</li>
            <li>Gagnez des coins en regardant des streams</li>
          </ul>
          <button className="role-cta viewer-cta" onClick={onLogin}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Se connecter avec Twitch
          </button>
        </div>

        <div className="role-separator">
          <div className="separator-line"></div>
          <span className="separator-or">OU</span>
          <div className="separator-line"></div>
        </div>

        <div
          className={`role-card role-streamer ${hoveredRole === 'streamer' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredRole('streamer')}
          onMouseLeave={() => setHoveredRole(null)}
        >
          <div className="role-icon-wrapper streamer-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <h3 className="role-title">Streamer</h3>
          <p className="role-desc">
            Creez vos propres boosters et cartes pour votre communaute.
          </p>
          <ul className="role-perks">
            <li>Creez des booster packs personnalises</li>
            <li>Designez vos propres cartes</li>
            <li>Gerez les rarites et les visuels</li>
            <li>Validation par un admin requise</li>
          </ul>
          <button className="role-cta streamer-cta" onClick={onLogin}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            Se connecter comme Streamer
          </button>
          <span className="role-note">Connexion Twitch + validation admin</span>
        </div>
      </div>

      {/* Features */}
      <div className="hero-features">
        <div className="hero-feature">
          <div className="feature-icon">&#128176;</div>
          <h4>Gagnez des Coins</h4>
          <p>Accumulez des coins pour acheter des boosters</p>
        </div>
        <div className="hero-feature">
          <div className="feature-icon">&#128230;</div>
          <h4>Ouvrez des Boosters</h4>
          <p>Chaque booster contient des cartes de differentes rarites</p>
        </div>
        <div className="hero-feature">
          <div className="feature-icon">&#127924;</div>
          <h4>Collectionnez</h4>
          <p>Des cartes communes aux ultra-legendaires</p>
        </div>
        <div className="hero-feature">
          <div className="feature-icon">&#9851;</div>
          <h4>Recyclez</h4>
          <p>Transformez vos doublons en coins</p>
        </div>
      </div>
    </div>
  )
}

export default App
