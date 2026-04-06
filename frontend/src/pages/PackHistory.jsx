import { useState, useEffect } from 'react';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import CardPreview from '../components/CardPreview';
import './PackHistory.css';

export default function PackHistory({ onBack }) {
  const toast = useToast();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadHistory(); }, [page]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getPackHistory(page);
      setOpenings(data.openings || []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (openingId) => {
    try {
      setDetailLoading(true);
      const data = await api.getOpeningDetail(openingId);
      setDetail(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="history-back" onClick={onBack}>&larr;</button>
        <h2>Historique des ouvertures</h2>
      </div>

      {loading ? (
        <div className="history-loading">
          {[1,2,3,4].map(i => <div key={i} className="history-skeleton shimmer" />)}
        </div>
      ) : openings.length === 0 ? (
        <div className="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
          <p>Aucun booster ouvert pour l'instant</p>
        </div>
      ) : (
        <>
          <div className="history-list">
            {openings.map(o => (
              <div key={o.id} className="history-item" onClick={() => showDetail(o.id)}>
                <div className="history-item-color" style={{
                  background: `linear-gradient(135deg, ${o.color_primary || '#444'}, ${o.color_accent || '#666'})`
                }} />
                <div className="history-item-info">
                  <div className="history-item-name">{o.booster_name}</div>
                  <div className="history-item-meta">
                    <span>{o.creator_name}</span>
                    <span className="history-dot">&middot;</span>
                    <span>{o.card_count} cartes</span>
                    <span className="history-dot">&middot;</span>
                    <span>{o.coins_spent} coins</span>
                  </div>
                </div>
                <div className="history-item-date">{formatDate(o.opened_at)}</div>
                <div className="history-item-arrow">&rsaquo;</div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="history-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&laquo; Precedent</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant &raquo;</button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div className="history-detail-overlay" onClick={() => setDetail(null)}>
          <div className="history-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="history-detail-close" onClick={() => setDetail(null)}>&times;</button>
            {detailLoading ? (
              <div className="history-detail-loading">Chargement...</div>
            ) : detail && (
              <>
                <h3>{detail.opening.booster_name || 'Ouverture'}</h3>
                <p className="history-detail-meta">
                  {detail.cards.length} cartes &middot; {detail.opening.coins_spent} coins &middot; {formatDate(detail.opening.opened_at)}
                </p>
                <div className="history-detail-cards">
                  {detail.cards.map(c => (
                    <div key={c.user_card_id} className="history-detail-card">
                      <CardPreview card={c} size="small" />
                      <span className="history-detail-card-name">{c.name}</span>
                      <span className={`profile-showcase-rarity rarity-${c.rarity}`}>{c.rarity}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
