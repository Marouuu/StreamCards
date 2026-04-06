import { useState, useEffect, useCallback } from 'react'
import { api } from '../config/api'
import { useToast } from '../components/Toast'
import CardPreview from '../components/CardPreview'
import './Auctions.css'

const RARITY_OPTIONS = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary']

export default function Auctions({ onBack, onUserUpdate, currentUserId }) {
  const [tab, setTab] = useState('browse')
  const [auctions, setAuctions] = useState([])
  const [myAuctions, setMyAuctions] = useState({ selling: [], bidding: [] })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ rarity: 'all', sort: 'ending_soon', search: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedAuction, setSelectedAuction] = useState(null)
  const [bidAmount, setBidAmount] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const toast = useToast()

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, sort: filters.sort }
      if (filters.rarity !== 'all') params.rarity = filters.rarity
      if (filters.search) params.search = filters.search
      const data = await api.getAuctions(params)
      setAuctions(data.auctions || [])
      setTotal(data.total || 0)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  const fetchMyAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getMyAuctions()
      setMyAuctions(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'browse') fetchAuctions()
    else fetchMyAuctions()
  }, [tab, fetchAuctions, fetchMyAuctions])

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === 'browse') fetchAuctions()
      else fetchMyAuctions()
    }, 15000)
    return () => clearInterval(interval)
  }, [tab, fetchAuctions, fetchMyAuctions])

  const handleBid = async (auctionId, amount) => {
    try {
      await api.placeBid(auctionId, parseInt(amount))
      toast.success('Enchere placee !')
      const userData = await api.getCurrentUser()
      if (userData) onUserUpdate(userData)
      if (selectedAuction) {
        const updated = await api.getAuction(auctionId)
        setSelectedAuction(updated)
      }
      if (tab === 'browse') fetchAuctions()
      else fetchMyAuctions()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleCancel = async (auctionId) => {
    try {
      await api.cancelAuction(auctionId)
      toast.success('Enchere annulee')
      const userData = await api.getCurrentUser()
      if (userData) onUserUpdate(userData)
      fetchMyAuctions()
      setSelectedAuction(null)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const openDetail = async (id) => {
    try {
      const data = await api.getAuction(id)
      setSelectedAuction({ ...data.auction, bids: data.bids || [] })
      setBidAmount('')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="auctions-page">
      <div className="auctions-header">
        <button className="auctions-back" onClick={onBack}>&larr; Retour</button>
        <h2>Encheres</h2>
        <div className="auctions-tabs">
          <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Parcourir</button>
          <button className={tab === 'my' ? 'active' : ''} onClick={() => setTab('my')}>Mes Encheres</button>
        </div>
        <button className="auctions-create-btn" onClick={() => setShowCreateModal(true)}>+ Nouvelle Enchere</button>
      </div>

      {tab === 'browse' && (
        <>
          <div className="auctions-filters">
            <input
              type="text"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
              className="auctions-search"
            />
            <select value={filters.rarity} onChange={e => { setFilters(f => ({ ...f, rarity: e.target.value })); setPage(1) }}>
              {RARITY_OPTIONS.map(r => (
                <option key={r} value={r}>{r === 'all' ? 'Toutes raretes' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1) }}>
              <option value="ending_soon">Fin imminente</option>
              <option value="newest">Plus recentes</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix decroissant</option>
              <option value="most_bids">Plus d'encheres</option>
            </select>
          </div>

          {loading ? (
            <div className="auctions-loading">Chargement...</div>
          ) : auctions.length === 0 ? (
            <div className="auctions-empty">Aucune enchere active pour le moment.</div>
          ) : (
            <>
              <div className="auctions-grid">
                {auctions.map(a => (
                  <AuctionCard key={a.id} auction={a} onClick={() => openDetail(a.id)} currentUserId={currentUserId} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="auctions-pagination">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prec.</button>
                  <span>{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suiv.</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'my' && (
        <div className="my-auctions">
          <h3>En vente ({myAuctions.selling?.length || 0})</h3>
          {loading ? (
            <div className="auctions-loading">Chargement...</div>
          ) : myAuctions.selling?.length === 0 ? (
            <div className="auctions-empty">Aucune enchere en cours.</div>
          ) : (
            <div className="auctions-grid">
              {myAuctions.selling?.map(a => (
                <AuctionCard key={a.id} auction={a} onClick={() => openDetail(a.id)} currentUserId={currentUserId} isMine />
              ))}
            </div>
          )}
          <h3>Mes mises ({myAuctions.bidding?.length || 0})</h3>
          {myAuctions.bidding?.length === 0 ? (
            <div className="auctions-empty">Aucune mise en cours.</div>
          ) : (
            <div className="auctions-grid">
              {myAuctions.bidding?.map(a => (
                <AuctionCard key={a.id} auction={a} onClick={() => openDetail(a.id)} currentUserId={currentUserId} />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedAuction && (
        <AuctionDetailModal
          auction={selectedAuction}
          currentUserId={currentUserId}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          onBid={handleBid}
          onCancel={handleCancel}
          onClose={() => setSelectedAuction(null)}
          onRefresh={() => openDetail(selectedAuction.id)}
        />
      )}

      {showCreateModal && (
        <CreateAuctionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            toast.success('Enchere creee !')
            if (tab === 'browse') fetchAuctions()
            else fetchMyAuctions()
          }}
        />
      )}
    </div>
  )
}

function AuctionCard({ auction, onClick, currentUserId, isMine }) {
  const timeLeft = getTimeLeft(auction.ends_at)
  const isEnding = timeLeft.totalMs < 3600000

  return (
    <div className={`auction-card${isEnding ? ' auction-ending' : ''}`} onClick={onClick}>
      <div className="auction-card-preview">
        <CardPreview card={{
          name: auction.name,
          rarity: auction.rarity,
          image_url: auction.image_url,
          description: auction.card_description,
          creator_display_name: auction.creator_name,
          outline_color: auction.outline_color,
          background_color: auction.background_color,
          text_color: auction.text_color,
          effect: auction.effect,
          effect_color: auction.effect_color,
          effect_intensity: auction.effect_intensity,
        }} size="small" />
      </div>
      <div className="auction-card-info">
        <div className="auction-card-name">{auction.name}</div>
        <div className={`auction-card-rarity rarity-${auction.rarity}`}>{auction.rarity}</div>
        <div className="auction-card-price">
          <span className="coin-icon">&#128176;</span> {auction.current_price?.toLocaleString()}
        </div>
        {auction.buyout_price && (
          <div className="auction-card-buyout">
            Achat immediat: {auction.buyout_price.toLocaleString()}
          </div>
        )}
        <div className="auction-card-bids">{auction.bid_count} enchere{auction.bid_count !== 1 ? 's' : ''}</div>
        <div className={`auction-card-time${isEnding ? ' ending' : ''}`}>
          {timeLeft.text}
        </div>
        {isMine && auction.highest_bidder && (
          <div className="auction-card-bidder">Meilleur: {auction.bidder_name || auction.highest_bidder}</div>
        )}
      </div>
    </div>
  )
}

function AuctionDetailModal({ auction, currentUserId, bidAmount, setBidAmount, onBid, onCancel, onClose, onRefresh }) {
  const isSeller = auction.seller_id === currentUserId
  const isHighest = auction.highest_bidder === currentUserId
  const timeLeft = getTimeLeft(auction.ends_at)
  const minBid = auction.bid_count > 0 ? auction.current_price + 10 : auction.starting_price

  return (
    <div className="auction-modal-overlay" onClick={onClose}>
      <div className="auction-modal" onClick={e => e.stopPropagation()}>
        <button className="auction-modal-close" onClick={onClose}>&times;</button>
        <div className="auction-modal-content">
          <div className="auction-modal-card">
            <CardPreview card={{
              name: auction.name,
              rarity: auction.rarity,
              image_url: auction.image_url,
              description: auction.card_description,
              creator_display_name: auction.creator_name,
              outline_color: auction.outline_color,
              background_color: auction.background_color,
              text_color: auction.text_color,
              effect: auction.effect,
              effect_color: auction.effect_color,
              effect_intensity: auction.effect_intensity,
            }} size="large" />
          </div>
          <div className="auction-modal-details">
            <h3>{auction.name}</h3>
            <div className={`auction-detail-rarity rarity-${auction.rarity}`}>{auction.rarity}</div>
            <div className="auction-detail-seller">Vendeur: {auction.seller_name || auction.seller_id}</div>

            <div className="auction-detail-prices">
              <div className="auction-detail-current">
                <span className="label">Prix actuel</span>
                <span className="value"><span className="coin-icon">&#128176;</span> {auction.current_price?.toLocaleString()}</span>
              </div>
              {auction.buyout_price && (
                <div className="auction-detail-buyout">
                  <span className="label">Achat immediat</span>
                  <span className="value"><span className="coin-icon">&#128176;</span> {auction.buyout_price.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="auction-detail-meta">
              <span>{auction.bid_count} enchere{auction.bid_count !== 1 ? 's' : ''}</span>
              <span className={timeLeft.totalMs < 3600000 ? 'ending' : ''}>{timeLeft.text}</span>
            </div>

            {isHighest && <div className="auction-detail-winning">Vous etes le meilleur encherisseur !</div>}

            {auction.status === 'active' && !isSeller && (
              <div className="auction-bid-section">
                <div className="auction-bid-row">
                  <input
                    type="number"
                    min={minBid}
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    placeholder={`Min: ${minBid}`}
                    className="auction-bid-input"
                  />
                  <button
                    className="auction-bid-btn"
                    onClick={() => onBid(auction.id, bidAmount)}
                    disabled={!bidAmount || parseInt(bidAmount) < minBid}
                  >
                    Encherir
                  </button>
                </div>
                {auction.buyout_price && (
                  <button
                    className="auction-buyout-btn"
                    onClick={() => onBid(auction.id, auction.buyout_price)}
                  >
                    Acheter maintenant ({auction.buyout_price.toLocaleString()} coins)
                  </button>
                )}
              </div>
            )}

            {isSeller && auction.status === 'active' && (
              <button className="auction-cancel-btn" onClick={() => onCancel(auction.id)}>Annuler l'enchere</button>
            )}

            {auction.status !== 'active' && (
              <div className={`auction-status-badge status-${auction.status}`}>
                {auction.status === 'sold' ? 'Vendu' : auction.status === 'expired' ? 'Expire' : 'Annule'}
              </div>
            )}

            {auction.bids?.length > 0 && (
              <div className="auction-bids-history">
                <h4>Historique des encheres</h4>
                <div className="auction-bids-list">
                  {auction.bids.map(b => (
                    <div key={b.id} className="auction-bid-item">
                      <span className="bid-user">{b.bidder_name || b.bidder_id}</span>
                      <span className="bid-amount"><span className="coin-icon">&#128176;</span> {b.amount.toLocaleString()}</span>
                      <span className="bid-time">{new Date(b.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateAuctionModal({ onClose, onCreated }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState(null)
  const [startingPrice, setStartingPrice] = useState(100)
  const [buyoutPrice, setBuyoutPrice] = useState('')
  const [durationHours, setDurationHours] = useState(24)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getUserCards()
        setCards(data.cards || [])
      } catch (e) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSubmit = async () => {
    if (!selectedCard) return toast.error('Selectionnez une carte')
    if (startingPrice < 1) return toast.error('Le prix minimum est 1')
    setSubmitting(true)
    try {
      await api.createAuction(selectedCard.user_card_id || selectedCard.id, startingPrice, durationHours, buyoutPrice ? parseInt(buyoutPrice) : undefined)
      onCreated()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auction-modal-overlay" onClick={onClose}>
      <div className="auction-modal auction-create-modal" onClick={e => e.stopPropagation()}>
        <button className="auction-modal-close" onClick={onClose}>&times;</button>
        <h3>Creer une enchere</h3>

        <div className="create-auction-form">
          <div className="create-auction-cards">
            <label>Choisir une carte</label>
            {loading ? (
              <div className="auctions-loading">Chargement...</div>
            ) : cards.length === 0 ? (
              <div className="auctions-empty">Aucune carte disponible.</div>
            ) : (
              <div className="create-auction-card-grid">
                {cards.map(c => (
                  <div
                    key={c.user_card_id || c.id}
                    className={`create-auction-card-item${selectedCard && (selectedCard.user_card_id || selectedCard.id) === (c.user_card_id || c.id) ? ' selected' : ''}`}
                    onClick={() => setSelectedCard(c)}
                  >
                    <CardPreview card={c} size="tiny" />
                    <div className="create-card-name">{c.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="create-auction-fields">
            <label>Prix de depart
              <input type="number" min={1} value={startingPrice} onChange={e => setStartingPrice(parseInt(e.target.value) || 0)} />
            </label>
            <label>Achat immediat (optionnel)
              <input type="number" min={0} value={buyoutPrice} onChange={e => setBuyoutPrice(e.target.value)} placeholder="Laisser vide si aucun" />
            </label>
            <label>Duree (heures)
              <select value={durationHours} onChange={e => setDurationHours(parseInt(e.target.value))}>
                <option value={1}>1h</option>
                <option value={6}>6h</option>
                <option value={12}>12h</option>
                <option value={24}>24h</option>
                <option value={48}>48h</option>
                <option value={72}>72h</option>
              </select>
            </label>
            <button className="create-auction-submit" onClick={handleSubmit} disabled={submitting || !selectedCard}>
              {submitting ? 'Creation...' : 'Mettre en enchere'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeLeft(endsAt) {
  const diff = new Date(endsAt) - Date.now()
  if (diff <= 0) return { text: 'Termine', totalMs: 0 }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 24) return { text: `${Math.floor(h / 24)}j ${h % 24}h`, totalMs: diff }
  if (h > 0) return { text: `${h}h ${m}m`, totalMs: diff }
  if (m > 0) return { text: `${m}m ${s}s`, totalMs: diff }
  return { text: `${s}s`, totalMs: diff }
}
