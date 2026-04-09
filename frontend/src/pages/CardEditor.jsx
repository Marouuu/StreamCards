import { useState, useEffect } from 'react';
import { api } from '../config/api';
import CardPreview from '../components/CardPreview';
import './CardEditor.css';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
const EFFECT_CATEGORIES = [
  { category: 'Aucun', effects: [
    { value: 'none', label: 'Aucun', icon: '❌' },
  ]},
  { category: 'Lumiere & Energie', effects: [
    { value: 'holographic', label: 'Holographique', icon: '🌈' },
    { value: 'shining', label: 'Brillant', icon: '✨' },
    { value: 'prismatic', label: 'Prismatique', icon: '💎' },
    { value: 'neon-glow', label: 'Neon', icon: '💡' },
    { value: 'aurora', label: 'Aurore boreale', icon: '🌌' },
  ]},
  { category: 'Feu & Chaleur', effects: [
    { value: 'lava', label: 'Lave', icon: '🌋' },
  ]},
  { category: 'Electrique', effects: [
    { value: 'electric-pulse', label: 'Impulsion', icon: '🔌' },
  ]},
  { category: 'Sombre & Mystique', effects: [
    { value: 'shadow', label: 'Ombre / Brume', icon: '🌫️' },
    { value: 'dark-aura', label: 'Aura sombre', icon: '🖤' },
    { value: 'void-portal', label: 'Portail du vide', icon: '🕳️' },
  ]},
  { category: 'Nature & Cosmos', effects: [
    { value: 'leaves', label: 'Feuilles', icon: '🍃' },
    { value: 'galaxy', label: 'Galaxie', icon: '🪐' },
  ]},
];

// Flat list for validation
const ALL_EFFECTS = EFFECT_CATEGORIES.flatMap(c => c.effects);

const RARITY_OUTLINE_DEFAULTS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

const DEFAULT_CARD = {
  name: 'Nouvelle carte',
  description: '',
  image_url: '',
  rarity: 'common',
  outline_color: '',
  background_color: '#1a1a2e',
  text_color: '#ffffff',
  effect: 'none',
  effect_color: '#ffffff',
  effect_intensity: 50,
};

function CardEditor({ packId, packName, onBack }) {
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_CARD });
  const [imageRightsAccepted, setImageRightsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState(null);

  useEffect(() => { loadCards(); loadLimits(); }, [packId]);

  const loadCards = async () => {
    setLoading(true);
    const data = await api.getPackCards(packId);
    setCards(data);
    setLoading(false);
  };

  const loadLimits = async () => {
    try {
      const data = await api.getPackLimits();
      setLimits(data);
    } catch { /* ignore */ }
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleNew = () => {
    setSelectedCardId(null);
    setForm({ ...DEFAULT_CARD });
    setImageRightsAccepted(false);
  };

  const handleSelect = (card) => {
    setSelectedCardId(card.id);
    setForm({
      name: card.name || '',
      description: card.description || '',
      image_url: card.image_url || '',
      rarity: card.rarity || 'common',
      outline_color: card.outline_color || '',
      background_color: card.background_color || '#1a1a2e',
      text_color: card.text_color || '#ffffff',
      effect: card.effect || 'none',
      effect_color: card.effect_color || '#ffffff',
      effect_intensity: card.effect_intensity ?? 50,
    });
    setImageRightsAccepted(false);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRarityChange = (rarity) => {
    setForm(prev => ({
      ...prev,
      rarity,
      outline_color: '', // reset to auto
    }));
  };

  const handleSave = async () => {
    if (!imageRightsAccepted) {
      showMsg('error', 'Vous devez accepter la responsabilite des droits d\'auteur des images.');
      return;
    }
    setSaving(true);
    try {
      const data = { ...form };
      // Send null for outline_color if empty (auto from rarity)
      if (!data.outline_color) data.outline_color = null;

      if (selectedCardId) {
        const updated = await api.updateCard(packId, selectedCardId, data);
        setCards(prev => prev.map(c => c.id === selectedCardId ? updated : c));
        showMsg('success', 'Carte mise à jour !');
      } else {
        const created = await api.createCard(packId, data);
        setCards(prev => [...prev, created]);
        setSelectedCardId(created.id);
        showMsg('success', 'Carte créée !');
      }
    } catch (err) {
      showMsg('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCardId) return;
    if (!confirm('Supprimer cette carte ?')) return;
    try {
      await api.deleteCard(packId, selectedCardId);
      setCards(prev => prev.filter(c => c.id !== selectedCardId));
      handleNew();
      showMsg('success', 'Carte supprimée.');
    } catch (err) {
      showMsg('error', err.message);
    }
  };

  // Group cards by rarity for the sidebar
  const cardsByRarity = {};
  for (const r of RARITIES) {
    const filtered = cards.filter(c => c.rarity === r);
    if (filtered.length > 0) cardsByRarity[r] = filtered;
  }

  // Preview card data (merge form with defaults)
  const previewCard = {
    ...form,
    outline_color: form.outline_color || RARITY_OUTLINE_DEFAULTS[form.rarity],
  };

  if (loading) {
    return <div className="ce-loading"><p>Chargement des cartes...</p></div>;
  }

  return (
    <div className="card-editor">
      <div className="ce-header">
        <button className="ce-back-btn" onClick={onBack}>←</button>
        <h1>Cartes — {packName}</h1>
        <div className="ce-header-right">
          <span className="ce-count">{cards.length}/{limits ? limits.maxCardsPerPack : 30} cartes</span>
          <button
            className={`ce-new-btn${limits && cards.length >= limits.maxCardsPerPack ? ' ce-new-btn-disabled' : ''}`}
            onClick={handleNew}
            disabled={cards.length >= (limits ? limits.maxCardsPerPack : 30)}
          >
            + Nouvelle Carte
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`ce-message ${message.type}`}>{message.text}</div>
      )}

      <div className="ce-layout">
        {/* Card list sidebar */}
        <div className="ce-sidebar">
          <h3>Pool de cartes</h3>
          <div className="ce-card-list">
            {Object.entries(cardsByRarity).map(([rarity, rarityCards]) => (
              <div key={rarity} className="ce-rarity-group">
                <div className={`ce-rarity-label rarity-${rarity}`}>
                  {rarity.replace('-', ' ')} ({rarityCards.length})
                </div>
                {rarityCards.map(card => (
                  <div
                    key={card.id}
                    className={`ce-card-item ${selectedCardId === card.id ? 'active' : ''}`}
                    onClick={() => handleSelect(card)}
                  >
                    <span className="ce-card-item-name">{card.name}</span>
                    {card.effect !== 'none' && (
                      <span className="ce-card-item-effect">{card.effect}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {cards.length === 0 && (
              <p className="ce-empty">Aucune carte. Ajoutez-en !</p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="ce-preview">
          <CardPreview card={previewCard} size="large" />
        </div>

        {/* Form */}
        <div className="ce-form">
          <div className="ce-form-section">
            <h3>Informations</h3>
            <label>
              <span>Nom</span>
              <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} maxLength={128} />
            </label>
            <label>
              <span>Description</span>
              <textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={2} placeholder="Texte de la carte..." />
            </label>
            <label>
              <span>Image URL</span>
              <input type="url" value={form.image_url} onChange={e => handleChange('image_url', e.target.value)} placeholder="https://... (PNG, JPG, GIF, WebP)" />
            </label>
          </div>

          <div className="ce-form-section">
            <h3>Rareté</h3>
            <div className="ce-rarity-select">
              {RARITIES.map(r => (
                <button
                  key={r}
                  className={`ce-rarity-btn rarity-${r} ${form.rarity === r ? 'active' : ''}`}
                  onClick={() => handleRarityChange(r)}
                >
                  {r.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="ce-form-section">
            <h3>Couleurs</h3>
            <div className="ce-colors">
              <label className="ce-color-pick">
                <span>Contour</span>
                <div className="ce-color-input-wrap">
                  <input
                    type="color"
                    value={form.outline_color || RARITY_OUTLINE_DEFAULTS[form.rarity]}
                    onChange={e => handleChange('outline_color', e.target.value)}
                  />
                  <span className="ce-color-hex">
                    {form.outline_color || 'auto'}
                  </span>
                  {form.outline_color && (
                    <button className="ce-color-reset" onClick={() => handleChange('outline_color', '')}>x</button>
                  )}
                </div>
              </label>
              <label className="ce-color-pick">
                <span>Fond</span>
                <div className="ce-color-input-wrap">
                  <input type="color" value={form.background_color} onChange={e => handleChange('background_color', e.target.value)} />
                  <span className="ce-color-hex">{form.background_color}</span>
                </div>
              </label>
              <label className="ce-color-pick">
                <span>Texte</span>
                <div className="ce-color-input-wrap">
                  <input type="color" value={form.text_color} onChange={e => handleChange('text_color', e.target.value)} />
                  <span className="ce-color-hex">{form.text_color}</span>
                </div>
              </label>
            </div>
          </div>

          <div className="ce-form-section">
            <h3>Effet spécial</h3>
            <div className="ce-effects-grid">
              {EFFECT_CATEGORIES.map(cat => (
                <div key={cat.category} className="ce-effect-category">
                  {cat.category !== 'Aucun' && <div className="ce-effect-category-label">{cat.category}</div>}
                  <div className="ce-effect-category-items">
                    {cat.effects.map(e => {
                      const isLocked = limits && limits.allowedEffects && !limits.allowedEffects.includes(e.value);
                      return (
                        <button
                          key={e.value}
                          className={`ce-effect-btn ${form.effect === e.value ? 'active' : ''} ${isLocked ? 'ce-effect-locked' : ''}`}
                          onClick={() => !isLocked && handleChange('effect', e.value)}
                          title={isLocked ? 'Streamer Premium requis' : e.label}
                          disabled={isLocked}
                        >
                          <span className="ce-effect-icon">{e.icon}</span>
                          <span className="ce-effect-label">{e.label}</span>
                          {isLocked && <span className="ce-lock-icon">&#128274;</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {form.effect !== 'none' && (
              <div className="ce-effect-options" style={limits && !limits.colorCustomization ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                <label className="ce-color-pick">
                  <span>Couleur de l'effet {limits && !limits.colorCustomization && <span className="ce-premium-tag">Premium</span>}</span>
                  <div className="ce-color-input-wrap">
                    <input type="color" value={form.effect_color} onChange={e => handleChange('effect_color', e.target.value)} />
                    <span className="ce-color-hex">{form.effect_color}</span>
                  </div>
                </label>
                <label>
                  <span>Intensité ({form.effect_intensity}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={form.effect_intensity}
                    onChange={e => handleChange('effect_intensity', parseInt(e.target.value))}
                    className="ce-slider"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="ce-rights-section">
            <label className="ce-rights-checkbox">
              <input
                type="checkbox"
                checked={imageRightsAccepted}
                onChange={e => setImageRightsAccepted(e.target.checked)}
              />
              <span>
                Je certifie detenir les droits d'auteur ou une licence valide sur les images
                utilisees pour cette carte. J'assume l'entiere responsabilite en cas de violation
                des droits de propriete intellectuelle de tiers.
              </span>
            </label>
          </div>

          <div className="ce-actions">
            <button className="ce-save-btn" onClick={handleSave} disabled={saving || !imageRightsAccepted}>
              {saving ? 'Enregistrement...' : selectedCardId ? 'Mettre à jour' : 'Créer la carte'}
            </button>
            {selectedCardId && (
              <button className="ce-delete-btn" onClick={handleDelete}>Supprimer</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardEditor;
