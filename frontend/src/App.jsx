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
          <span className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="3"/>
              <path d="M8 7v10M12 7v10M16 7v10" opacity="0.5"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <span className="logo-text">StreamCards</span>
        </h1>
        <nav>
          {loading ? (
            <span className="loading-text">Chargement...</span>
          ) : user ? (
            <div className="user-info">
              {/* Left group: Shop + Coins */}
              <div className="nav-left-group">
                <button className={`shop-btn casino-btn${currentPage === 'shop' ? ' nav-active' : ''}`} onClick={() => setCurrentPage('shop')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                  SHOP
                </button>
                <button className="coins-btn" onClick={() => setCurrentPage('dashboard')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v12M8 10h8M8 14h8" opacity="0.7"/>
                  </svg>
                  {(user.coins || 0).toLocaleString()}
                </button>
              </div>

              {/* Right group: Notifications + Profile + Menu */}
              <div className="nav-right-group">
                <NotificationBell />
                <div className="nav-profile-wrapper" ref={moreRef}>
                  <button className={`nav-profile-btn${moreMenuOpen ? ' nav-profile-open' : ''}`} onClick={() => setMoreMenuOpen(!moreMenuOpen)}>
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt={user.displayName || user.username}
                        className="nav-profile-avatar"
                      />
                    ) : (
                      <div className="nav-profile-fallback">
                        {(user.displayName || user.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <svg className="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {moreMenuOpen && (
                    <div className="nav-more-dropdown">
                      {/* User info header */}
                      <div className="nav-dropdown-user">
                        {user.profileImageUrl && <img src={user.profileImageUrl} alt="" className="dropdown-user-avatar" />}
                        <div className="dropdown-user-info">
                          <span className="dropdown-user-name">{user.displayName || user.username}</span>
                          <span className="dropdown-user-coins">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                            {(user.coins || 0).toLocaleString()} coins
                          </span>
                        </div>
                      </div>
                      <div className="nav-more-divider" />

                      {/* Main navigation */}
                      <div className="nav-dropdown-section-label">Navigation</div>
                      <button className={currentPage === 'dashboard' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('dashboard'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </span> Dashboard
                      </button>
                      <button className={currentPage === 'collection' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('collection'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </span> Collection
                      </button>
                      <button className={currentPage === 'marketplace' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('marketplace'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                        </span> Marche
                      </button>
                      <button className={currentPage === 'trades' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('trades'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                        </span> Echanges
                      </button>
                      <button className={currentPage === 'auctions' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('auctions'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                        </span> Encheres
                      </button>
                      <div className="nav-more-divider" />

                      {/* Social */}
                      <div className="nav-dropdown-section-label">Social</div>
                      <button className={currentPage === 'friends' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('friends'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                        </span> Amis
                      </button>
                      <button className={currentPage === 'leaderboard' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('leaderboard'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/></svg>
                        </span> Classement
                      </button>
                      <div className="nav-more-divider" />

                      {/* Progress */}
                      <div className="nav-dropdown-section-label">Progression</div>
                      <button className={currentPage === 'rewards' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('rewards'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        </span> Quetes
                      </button>
                      <button className={currentPage === 'achievements' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('achievements'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                        </span> Succes
                      </button>
                      <button className={currentPage === 'history' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('history'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </span> Historique
                      </button>
                      <div className="nav-more-divider" />

                      {/* Account */}
                      <button className={currentPage === 'profile' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('profile'); setMoreMenuOpen(false); }}>
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </span> Profil
                      </button>
                      {user.isStreamer && (
                        <>
                          <button className={currentPage === 'pack-manager' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('pack-manager'); setMoreMenuOpen(false); }}>
                            <span className="nav-more-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                            </span> Mes Packs
                          </button>
                          <button className={currentPage === 'twitch-integration' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('twitch-integration'); setMoreMenuOpen(false); }}>
                            <span className="nav-more-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                            </span> Twitch CP
                          </button>
                          <button className={currentPage === 'analytics' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('analytics'); setMoreMenuOpen(false); }}>
                            <span className="nav-more-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            </span> Analytics
                          </button>
                        </>
                      )}
                      {user.isAdmin && (
                        <button className={currentPage === 'admin' ? 'nav-more-active' : ''} onClick={() => { setCurrentPage('admin'); setMoreMenuOpen(false); }}>
                          <span className="nav-more-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                          </span> Admin
                        </button>
                      )}
                      <div className="nav-more-divider" />
                      <button onClick={() => { handleLogout(); setMoreMenuOpen(false); }} className="nav-more-logout">
                        <span className="nav-more-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </span> Deconnexion
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
