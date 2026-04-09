import { useState, useEffect, useRef } from 'react'
import './App.css'
import FloatingBackground from './components/FloatingBackground'
import { ToastProvider, useToast } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Shop from './pages/Shop'
import PackManager from './pages/PackManager'
import Collection from './pages/Collection'
import AdminPanel from './pages/AdminPanel'
import Marketplace from './pages/Marketplace'
import Leaderboard from './pages/Leaderboard'
import DailyRewards from './pages/DailyRewards'
import Trades from './pages/Trades'
import Profile from './pages/Profile'
import PackHistory from './pages/PackHistory'
import Achievements from './pages/Achievements'
import Analytics from './pages/Analytics'
import Auctions from './pages/Auctions'
import Friends from './pages/Friends'
import TwitchIntegration from './pages/TwitchIntegration'
import Legal from './pages/Legal'
import NotificationBell from './components/NotificationBell'
import Tutorial from './components/Tutorial'
import { api } from './config/api'
import { getToken, setToken, removeToken } from './utils/auth'

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

function AppInner() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const moreRef = useRef(null)
  const toast = useToast()

  // Close "more" dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Check for OAuth callback token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const error = urlParams.get('error')

    if (token) {
      setToken(token)
      const scopeUpgraded = urlParams.get('scope_upgraded')
      window.history.replaceState({}, document.title, window.location.pathname)
      fetchUser()
      if (scopeUpgraded) {
        setCurrentPage('twitch-integration')
        toast.success('Autorisations Twitch mises a jour !')
      }
    } else if (error) {
      console.error('OAuth error:', error)
      toast.error(`Connexion echouee : ${error}`)
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
        if (!localStorage.getItem('streamcards_tutorial_done')) {
          setShowTutorial(true)
        }
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
      toast.success('Votre demande de streamer a ete envoyee ! Un admin va la valider.')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="app">
      <FloatingBackground />
      {showTutorial && (
        <Tutorial
          onComplete={() => setShowTutorial(false)}
          onNavigate={setCurrentPage}
        />
      )}
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
              <NotificationBell />
              <button className="coins-btn">
                <span className="coin-icon">&#128176;</span> {(user.coins || 0).toLocaleString()}
              </button>
              <button className={`shop-btn casino-btn${currentPage === 'shop' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('shop')}>
                SHOP
              </button>
              <button className={`collection-btn${currentPage === 'collection' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('collection')}>
                COLLECTION
              </button>
              <button className={`market-btn${currentPage === 'marketplace' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('marketplace')}>
                MARCHE
              </button>
              <button className={`trades-btn${currentPage === 'trades' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('trades')}>
                ECHANGES
              </button>
              <button className={`auction-nav-btn${currentPage === 'auctions' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('auctions')}>
                ENCHERES
              </button>
              <div className="nav-more-wrapper" ref={moreRef}>
                <button className={`nav-more-btn${moreMenuOpen ? ' nav-more-open' : ''}`} onClick={() => setMoreMenuOpen(!moreMenuOpen)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                </button>
                {moreMenuOpen && (
                  <div className="nav-more-dropdown">
                    <button className={`nav-more-mobile-only${currentPage === 'marketplace' ? ' nav-more-active' : ''}`} onClick={() => { setCurrentPage('marketplace'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128176;</span> Marche
                    </button>
                    <button className={`nav-more-mobile-only${currentPage === 'trades' ? ' nav-more-active' : ''}`} onClick={() => { setCurrentPage('trades'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128260;</span> Echanges
                    </button>
                    <button className={`nav-more-mobile-only${currentPage === 'auctions' ? ' nav-more-active' : ''}`} onClick={() => { setCurrentPage('auctions'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128296;</span> Encheres
                    </button>
                    <div className="nav-more-divider nav-more-mobile-only" />
                    {user.isStreamer && (
                      <button className={currentPage === 'pack-manager' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('pack-manager'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">&#128230;</span> Mes Packs
                      </button>
                    )}
                    <button className={currentPage === 'friends' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('friends'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128101;</span> Amis
                    </button>
                    <button className={currentPage === 'leaderboard' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('leaderboard'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#127942;</span> Classement
                    </button>
                    <button className={currentPage === 'rewards' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('rewards'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#127873;</span> Quetes
                    </button>
                    <button className={currentPage === 'profile' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('profile'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128100;</span> Profil
                    </button>
                    <button className={currentPage === 'history' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('history'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#128218;</span> Historique
                    </button>
                    <button className={currentPage === 'achievements' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('achievements'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#127942;</span> Succes
                    </button>
                    {user.isStreamer && (
                      <button className={currentPage === 'twitch-integration' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('twitch-integration'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">&#127909;</span> Twitch CP
                      </button>
                    )}
                    {user.isStreamer && (
                      <button className={currentPage === 'analytics' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('analytics'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">&#128202;</span> Analytics
                      </button>
                    )}
                    {user.isAdmin && (
                      <button className={currentPage === 'admin' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('admin'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">&#9881;</span> Admin
                      </button>
                    )}
                    <button onClick={() => { setCurrentPage('legal'); setMoreMenuOpen(false); }}>
                      <span className="nav-more-icon">&#9878;</span> Mentions Legales
                    </button>
                    <div className="nav-more-divider" />
                    <button onClick={handleLogout} className="nav-more-logout">
                      <span className="nav-more-icon">&#128682;</span> Deconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </nav>
      </header>

      <main className="app-main">
        {currentPage === 'legal' ? (
          <Legal onBack={() => setCurrentPage(user ? 'dashboard' : 'home')} />
        ) : user ? (
          currentPage === 'shop' ? (
            <Shop
              onBack={() => setCurrentPage('dashboard')}
              onUserUpdate={setUser}
            />
          ) : currentPage === 'pack-manager' && user.isStreamer ? (
            <PackManager onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'collection' ? (
            <Collection onBack={() => setCurrentPage('dashboard')} onUserUpdate={setUser} />
          ) : currentPage === 'marketplace' ? (
            <Marketplace onBack={() => setCurrentPage('dashboard')} onUserUpdate={setUser} currentUserId={user.twitchId} />
          ) : currentPage === 'leaderboard' ? (
            <Leaderboard onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'rewards' ? (
            <DailyRewards onBack={() => setCurrentPage('dashboard')} onUserUpdate={setUser} />
          ) : currentPage === 'trades' ? (
            <Trades onBack={() => setCurrentPage('dashboard')} currentUserId={user.twitchId} />
          ) : currentPage === 'profile' ? (
            <Profile onBack={() => setCurrentPage('dashboard')} userId={user.twitchId} isOwnProfile={true} />
          ) : currentPage === 'history' ? (
            <PackHistory onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'achievements' ? (
            <Achievements onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'auctions' ? (
            <Auctions onBack={() => setCurrentPage('dashboard')} onUserUpdate={setUser} currentUserId={user.twitchId} />
          ) : currentPage === 'friends' ? (
            <Friends onBack={() => setCurrentPage('dashboard')} currentUserId={user.twitchId} />
          ) : currentPage === 'twitch-integration' && user.isStreamer ? (
            <TwitchIntegration onBack={() => setCurrentPage('dashboard')} isAdmin={user.isAdmin} />
          ) : currentPage === 'analytics' && user.isStreamer ? (
            <Analytics onBack={() => setCurrentPage('dashboard')} />
          ) : currentPage === 'admin' && user.isAdmin ? (
            <AdminPanel onBack={() => setCurrentPage('dashboard')} />
          ) : (
            <Dashboard
              user={user}
              onStreamerRequest={handleStreamerRequest}
              onUserUpdate={setUser}
              onNavigate={setCurrentPage}
            />
          )
        ) : (
          <HeroSection onLogin={handleTwitchLogin} onNavigate={setCurrentPage} />
        )}
      </main>
    </div>
  )
}

/* ==============================
   HERO SECTION (Landing Page)
   ============================== */
function HeroSection({ onLogin, onNavigate }) {
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

      {/* Footer legal */}
      <footer className="hero-footer">
        <div className="hero-footer-links">
          <button className="hero-footer-link" onClick={() => onNavigate('legal')}>
            Mentions Legales
          </button>
          <span className="hero-footer-sep">|</span>
          <button className="hero-footer-link" onClick={() => onNavigate('legal')}>
            CGU
          </button>
          <span className="hero-footer-sep">|</span>
          <button className="hero-footer-link" onClick={() => onNavigate('legal')}>
            Politique de Confidentialite
          </button>
        </div>
        <p className="hero-footer-copy">
          &copy; {new Date().getFullYear()} StreamCards — Projet non commercial. Aucune donnee vendue.
        </p>
      </footer>
    </div>
  )
}

export default App
