import { useState } from 'react'
import './App.css'
import Background3D from './components/Background3D'

function App() {
  const [user, setUser] = useState(null)

  return (
    <div className="app">
      <Background3D />
      <header className="app-header">
        <h1>🎴 StreamCards</h1>
        <nav>
          {user ? (
            <div className="user-info">
              <span>Welcome, {user.username}!</span>
              <span>Coins: {user.coins}</span>
            </div>
          ) : (
            <button className="twitch-login-btn">
              Connect Twitch
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
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
      </main>
    </div>
  )
}

export default App
