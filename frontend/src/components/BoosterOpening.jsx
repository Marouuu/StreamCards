import { Suspense, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import Booster3D from './Booster3D';
import CardPreview from './CardPreview';
import './BoosterOpening.css';

// ── Sound effects using Web Audio API ──
function createAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

function playShakeSound(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.6);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.6);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}

function playTearSound(ctx) {
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

function playCardRevealSound(ctx, index) {
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const baseNote = 523.25; // C5
  const notes = [0, 2, 4, 5, 7]; // Major scale intervals
  osc.frequency.value = baseNote * Math.pow(2, (notes[index % 5]) / 12);
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.3);

  // Sparkle noise
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.08, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  const hipass = ctx.createBiquadFilter();
  hipass.type = 'highpass';
  hipass.frequency.value = 6000;
  noise.connect(hipass).connect(noiseGain).connect(ctx.destination);
  noise.start(time);
}

function playFanfareSound(ctx) {
  const time = ctx.currentTime;
  const chords = [
    [523, 659, 784],   // C major
    [587, 740, 880],   // D major
    [659, 784, 988],   // E minor-ish
    [784, 988, 1175],  // G major
  ];

  chords.forEach((chord, ci) => {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = ci < 3 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const start = time + ci * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  });
}

// ── Main Component ──
function BoosterOpening({ booster, onClose, cards }) {
  const [phase, setPhase] = useState('idle'); // idle, opening, cards-flying, recap
  const [flyingCardIndex, setFlyingCardIndex] = useState(-1);
  const audioCtxRef = useRef(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // Cleanup audio context
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const handleOpen = () => {
    const ctx = getAudioCtx();
    setPhase('opening');
    playShakeSound(ctx);

    // After shake, play tear sound
    setTimeout(() => playTearSound(ctx), 800);

    // Cards start flying out — longer pause for suspense
    setTimeout(() => {
      setPhase('cards-flying');
      setFlyingCardIndex(0);
    }, 2800);
  };

  // Stagger flying cards one by one
  useEffect(() => {
    if (phase !== 'cards-flying' || !cards) return;
    if (flyingCardIndex < 0) return;

    if (flyingCardIndex < cards.length) {
      const ctx = getAudioCtx();
      playCardRevealSound(ctx, flyingCardIndex);

      const timer = setTimeout(() => {
        setFlyingCardIndex(prev => prev + 1);
      }, 900);
      return () => clearTimeout(timer);
    } else {
      // All cards revealed, show recap
      const ctx = getAudioCtx();
      playFanfareSound(ctx);
      const timer = setTimeout(() => setPhase('recap'), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, flyingCardIndex, cards, getAudioCtx]);

  // Count cards by rarity for summary
  const raritySummary = {};
  if (cards) {
    for (const card of cards) {
      const r = card.rarity || 'common';
      raritySummary[r] = (raritySummary[r] || 0) + 1;
    }
  }

  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
  const isOpening = phase === 'opening' || phase === 'cards-flying';

  return (
    <div className="booster-opening-overlay">
      <div className="booster-opening-container">
        {phase === 'idle' && (
          <button className="close-opening-btn" onClick={onClose}>&#10005;</button>
        )}

        {phase !== 'recap' && (
          <h2 className="opening-title">{booster?.name || 'Booster Pack'}</h2>
        )}

        {/* 3D Booster scene — visible during idle, opening, and cards-flying */}
        {phase !== 'recap' && (
          <div className={`booster-canvas-container ${phase === 'cards-flying' ? 'canvas-shrink' : ''}`}>
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
                  isOpening={isOpening}
                  rarity={booster?.rarity || 'common'}
                  name={booster?.name || 'Booster Pack'}
                  subtitle={booster?.subtitle || null}
                  imageUrl={booster?.image_url || booster?.imageUrl || null}
                  colorPrimary={booster?.color_primary || null}
                  colorAccent={booster?.color_accent || null}
                  colorText={booster?.color_text || null}
                  colorBackground={booster?.color_background || null}
                  onOpenComplete={() => {}}
                />
              </Suspense>

              <OrbitControls
                enableZoom={false}
                enablePan={false}
                enableRotate={!isOpening}
                autoRotate={!isOpening}
                autoRotateSpeed={1.5}
                maxPolarAngle={Math.PI * 0.65}
                minPolarAngle={Math.PI * 0.35}
              />
            </Canvas>
          </div>
        )}

        {/* Open button */}
        {phase === 'idle' && (
          <button className="open-booster-btn" onClick={handleOpen}>
            Ouvrir le booster
          </button>
        )}

        {/* Cards flying out one by one */}
        {phase === 'cards-flying' && cards && (
          <div className="cards-flying-container">
            {cards.map((card, index) => {
              if (index > flyingCardIndex) return null;
              return (
                <div
                  key={index}
                  className={`flying-card ${index === flyingCardIndex ? 'flying-card--active' : 'flying-card--landed'}`}
                  style={{ '--card-index': index, '--total-cards': cards.length }}
                >
                  {card.isMock ? (
                    <div className="card-reveal-mock">
                      <div className="mock-rarity">{(card.rarity || 'common').toUpperCase()}</div>
                    </div>
                  ) : (
                    <CardPreview card={card} size="small" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recap screen */}
        {phase === 'recap' && cards && (
          <div className="opened-cards-recap">
            <h3>Cartes obtenues !</h3>

            <div className="cards-reveal-grid">
              {cards.map((card, index) => (
                <div
                  key={index}
                  className="card-reveal-wrapper"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {card.isNew === false && (
                    <span className="card-badge card-badge--duplicate">DOUBLON</span>
                  )}
                  {card.isNew === true && (
                    <span className="card-badge card-badge--new">NEW</span>
                  )}
                  {card.isMock ? (
                    <div className="card-reveal-mock">
                      <div className="mock-rarity">{(card.rarity || 'common').toUpperCase()}</div>
                      <div className="mock-label">Carte #{card.id}</div>
                    </div>
                  ) : (
                    <CardPreview card={card} size="medium" />
                  )}
                </div>
              ))}
            </div>

            <div className="recap-summary">
              {rarityOrder
                .filter(r => raritySummary[r])
                .map(r => (
                  <span key={r} className={`recap-pill rarity-pill--${r}`}>
                    {raritySummary[r]}x {r.toUpperCase().replace('-', ' ')}
                  </span>
                ))}
            </div>

            <button className="recap-close-btn" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoosterOpening;
