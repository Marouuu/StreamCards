import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { api } from '../config/api';
import Booster3D from '../components/Booster3D';
import './PackManager.css';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

const DEFAULT_FORM = {
  name: 'My Booster Pack',
  subtitle: '',
  description: '',
  image_url: '',
  price: 100,
  cards_count: 5,
  rarity: 'common',
  color_primary: '#8a8a8a',
  color_accent: '#d0d0d0',
  color_text: '#ffffff',
  color_background: '#1a1a2e',
  is_published: false,
};

function PackManager({ onBack }) {
  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    setLoading(true);
    const data = await api.getMyPacks();
    setPacks(data);
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleNewPack = () => {
    setSelectedPackId(null);
    setForm({ ...DEFAULT_FORM });
  };

  const handleSelectPack = (pack) => {
    setSelectedPackId(pack.id);
    setForm({
      name: pack.name || '',
      subtitle: pack.subtitle || '',
      description: pack.description || '',
      image_url: pack.image_url || '',
      price: pack.price || 100,
      cards_count: pack.cards_count || 5,
      rarity: pack.rarity || 'common',
      color_primary: pack.color_primary || '#8a8a8a',
      color_accent: pack.color_accent || '#d0d0d0',
      color_text: pack.color_text || '#ffffff',
      color_background: pack.color_background || '#1a1a2e',
      is_published: pack.is_published || false,
    });
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedPackId) {
        const updated = await api.updatePack(selectedPackId, form);
        setPacks(prev => prev.map(p => p.id === selectedPackId ? updated : p));
        showMessage('success', 'Pack mis à jour !');
      } else {
        const created = await api.createPack(form);
        setPacks(prev => [created, ...prev]);
        setSelectedPackId(created.id);
        showMessage('success', 'Pack créé !');
      }
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPackId) return;
    if (!confirm('Supprimer ce pack ?')) return;
    try {
      await api.deletePack(selectedPackId);
      setPacks(prev => prev.filter(p => p.id !== selectedPackId));
      handleNewPack();
      showMessage('success', 'Pack supprimé.');
    } catch (err) {
      showMessage('error', err.message);
    }
  };

  const handleRarityPreset = (rarity) => {
    const presets = {
      common: { color_primary: '#8a8a8a', color_accent: '#d0d0d0' },
      uncommon: { color_primary: '#1a6b1a', color_accent: '#2ecc40' },
      rare: { color_primary: '#0a3d6b', color_accent: '#0096ff' },
      epic: { color_primary: '#3d0a6b', color_accent: '#9600ff' },
      legendary: { color_primary: '#6b4a00', color_accent: '#ffd700' },
      'ultra-legendary': { color_primary: '#ff0040', color_accent: '#ff00ff' },
    };
    const preset = presets[rarity] || presets.common;
    setForm(prev => ({ ...prev, rarity, ...preset }));
  };

  if (loading) {
    return (
      <div className="pm-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="pack-manager">
      <div className="pm-header">
        {onBack && <button className="pm-back-btn" onClick={onBack}>←</button>}
        <h1>Mes Packs</h1>
        <button className="pm-new-btn" onClick={handleNewPack}>+ Nouveau Pack</button>
      </div>

      {message.text && (
        <div className={`pm-message ${message.type}`}>{message.text}</div>
      )}

      <div className="pm-layout">
        {/* Pack List */}
        <div className="pm-sidebar">
          <h3>Mes packs ({packs.length})</h3>
          <div className="pm-pack-list">
            {packs.map(pack => (
              <div
                key={pack.id}
                className={`pm-pack-item ${selectedPackId === pack.id ? 'active' : ''}`}
                onClick={() => handleSelectPack(pack)}
              >
                <div className="pm-pack-item-info">
                  <span className="pm-pack-item-name">{pack.name}</span>
                  <span className={`pm-pack-item-rarity rarity-${pack.rarity}`}>
                    {pack.rarity}
                  </span>
                </div>
                <div className="pm-pack-item-meta">
                  <span>{pack.price} coins</span>
                  <span className={`pm-status ${pack.is_published ? 'published' : 'draft'}`}>
                    {pack.is_published ? 'Publié' : 'Brouillon'}
                  </span>
                </div>
              </div>
            ))}
            {packs.length === 0 && (
              <p className="pm-empty">Aucun pack créé. Cliquez sur "+ Nouveau Pack".</p>
            )}
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="pm-editor">
          {/* 3D Preview */}
          <div className="pm-preview">
            <Canvas
              camera={{ position: [0, 0, 7], fov: 45 }}
              gl={{ alpha: true, antialias: true, toneMapping: 3 }}
            >
              <PerspectiveCamera makeDefault position={[0, 0, 7]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 8, 5]} intensity={1.2} />
              <directionalLight position={[-5, -3, 5]} intensity={0.4} />
              <pointLight position={[0, 0, 4]} intensity={0.8} color="#ffffff" />
              <Suspense fallback={null}>
                <Booster3D
                  rarity={form.rarity}
                  name={form.name}
                  subtitle={form.subtitle || null}
                  imageUrl={form.image_url || null}
                  colorPrimary={form.color_primary}
                  colorAccent={form.color_accent}
                  colorText={form.color_text}
                  colorBackground={form.color_background}
                />
              </Suspense>
              <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={1.5}
                maxPolarAngle={Math.PI * 0.65}
                minPolarAngle={Math.PI * 0.35}
              />
            </Canvas>
          </div>

          {/* Form */}
          <div className="pm-form">
            <div className="pm-form-section">
              <h3>Informations</h3>
              <label>
                <span>Nom du pack</span>
                <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} maxLength={128} />
              </label>
              <label>
                <span>Sous-titre</span>
                <input type="text" value={form.subtitle} onChange={e => handleChange('subtitle', e.target.value)} placeholder="Ex: Édition limitée..." maxLength={256} />
              </label>
              <label>
                <span>Description</span>
                <textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={3} placeholder="Décrivez votre pack..." />
              </label>
              <label>
                <span>Image URL</span>
                <input type="url" value={form.image_url} onChange={e => handleChange('image_url', e.target.value)} placeholder="https://..." />
              </label>
            </div>

            <div className="pm-form-section">
              <h3>Paramètres</h3>
              <div className="pm-form-row">
                <label>
                  <span>Prix (coins)</span>
                  <input type="number" value={form.price} onChange={e => handleChange('price', parseInt(e.target.value) || 0)} min={1} />
                </label>
                <label>
                  <span>Nombre de cartes</span>
                  <input type="number" value={form.cards_count} onChange={e => handleChange('cards_count', parseInt(e.target.value) || 1)} min={1} max={20} />
                </label>
              </div>
              <label>
                <span>Rareté</span>
                <div className="pm-rarity-select">
                  {RARITIES.map(r => (
                    <button
                      key={r}
                      className={`pm-rarity-btn rarity-${r} ${form.rarity === r ? 'active' : ''}`}
                      onClick={() => handleRarityPreset(r)}
                    >
                      {r.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div className="pm-form-section">
              <h3>Couleurs</h3>
              <div className="pm-colors">
                <label className="pm-color-pick">
                  <span>Primaire</span>
                  <div className="pm-color-input-wrap">
                    <input type="color" value={form.color_primary} onChange={e => handleChange('color_primary', e.target.value)} />
                    <span className="pm-color-hex">{form.color_primary}</span>
                  </div>
                </label>
                <label className="pm-color-pick">
                  <span>Accent</span>
                  <div className="pm-color-input-wrap">
                    <input type="color" value={form.color_accent} onChange={e => handleChange('color_accent', e.target.value)} />
                    <span className="pm-color-hex">{form.color_accent}</span>
                  </div>
                </label>
                <label className="pm-color-pick">
                  <span>Texte</span>
                  <div className="pm-color-input-wrap">
                    <input type="color" value={form.color_text} onChange={e => handleChange('color_text', e.target.value)} />
                    <span className="pm-color-hex">{form.color_text}</span>
                  </div>
                </label>
                <label className="pm-color-pick">
                  <span>Fond (dos)</span>
                  <div className="pm-color-input-wrap">
                    <input type="color" value={form.color_background} onChange={e => handleChange('color_background', e.target.value)} />
                    <span className="pm-color-hex">{form.color_background}</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pm-form-section">
              <label className="pm-publish-toggle">
                <input type="checkbox" checked={form.is_published} onChange={e => handleChange('is_published', e.target.checked)} />
                <span>Publier dans la boutique</span>
              </label>
            </div>

            <div className="pm-actions">
              <button className="pm-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : selectedPackId ? 'Mettre à jour' : 'Créer le pack'}
              </button>
              {selectedPackId && (
                <button className="pm-delete-btn" onClick={handleDelete}>Supprimer</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PackManager;
