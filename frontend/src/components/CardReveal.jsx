import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import CardMini3D from './CardMini3D';
import './CardReveal.css';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];

const RARITY_LABELS = {
  common: 'Commune',
  uncommon: 'Peu commune',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
  'ultra-legendary': 'Ultra Legendaire',
};

const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

const CARD_W = 2.5;
const CARD_H = 3.5;
const CARD_D = 0.03;
const CORNER_R = 0.12;
const SWIPE_THRESHOLD = 1.5; // distance to trigger dismiss

// ─── Texture hooks ───────────────────────────────────────

function useImageTexture(url) {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    if (!url) { setTexture(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    };
    img.onerror = () => setTexture(null);
    img.src = url;
  }, [url]);
  return texture;
}

function useCardBackTexture(rarity, creatorName) {
  return useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d');
    const color = RARITY_COLORS[rarity] || RARITY_COLORS.common;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(256, 358, 0, 256, 358, 350);
    glow.addColorStop(0, color + '30');
    glow.addColorStop(0.5, color + '10');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.06;
    for (let py = 0; py < canvas.height; py += 40) {
      for (let px = 0; px < canvas.width; px += 40) {
        ctx.save();
        ctx.translate(px + 20, py + 20);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 20);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 - 20);
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fillStyle = color + '15';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SC', 0, 0);
    ctx.restore();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STREAMCARDS', canvas.width / 2, canvas.height - 40);
    ctx.globalAlpha = 1;

    if (creatorName) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      ctx.font = '13px Arial';
      ctx.fillText(creatorName, canvas.width / 2, canvas.height - 60);
      ctx.globalAlpha = 1;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  })[0];
}

function useCardFrontTexture(imageUrl, card) {
  const imageTex = useImageTexture(imageUrl);
  const [fallback] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = card?.background_color || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = card?.text_color || '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card?.name || 'Card', canvas.width / 2, canvas.height / 2);
    const color = RARITY_COLORS[card?.rarity] || '#a0a0a0';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 18px Arial';
    ctx.fillText((card?.rarity || 'common').toUpperCase(), canvas.width / 2, canvas.height / 2 + 40);
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });
  return imageTex || fallback;
}

// ─── Card geometry (shared) ──────────────────────────────

let _sharedGeo = null;
function getCardGeometry() {
  if (_sharedGeo) return _sharedGeo;
  const shape = new THREE.Shape();
  const x = -CARD_W / 2, y = -CARD_H / 2, w = CARD_W, h = CARD_H, r = CORNER_R;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_D, bevelEnabled: true,
    bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2,
  });

  const posAttr = geo.getAttribute('position');
  const normalAttr = geo.getAttribute('normal');
  const uvAttr = geo.getAttribute('uv');
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i), py = posAttr.getY(i), nz = normalAttr.getZ(i);
    if (Math.abs(nz) > 0.5) {
      uvAttr.setXY(i, (px + CARD_W / 2) / CARD_W, (py + CARD_H / 2) / CARD_H);
    }
  }
  uvAttr.needsUpdate = true;
  geo.computeVertexNormals();
  _sharedGeo = geo;
  return geo;
}

// ─── Swipeable 3D Card ──────────────────────────────────

function SwipeableCard({ card, onFlip, onSwiped, isActive, enterFrom }) {
  const groupRef = useRef();
  const { camera, gl } = useThree();
  const rarity = card.rarity || 'common';
  const glowColor = card.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const creatorName = card.creator_display_name || card.creator_name || null;
  const isHighRarity = ['epic', 'legendary', 'ultra-legendary'].includes(rarity);

  const frontTex = useCardFrontTexture(card.image_url, card);
  const backTex = useCardBackTexture(rarity, creatorName);
  const cardGeo = getCardGeometry();

  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTex,
    metalness: isHighRarity ? 0.4 : 0.15,
    roughness: isHighRarity ? 0.3 : 0.5,
  });
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, metalness: 0.2, roughness: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: glowColor, metalness: 0.3, roughness: 0.4 });
  const materials = [edgeMat, frontMat, backMat];

  // State
  const stateRef = useRef({
    flipped: false,       // showing front?
    flipAnim: 1,          // 0=front, 1=back (starts showing back)
    dragging: false,
    dragStart: new THREE.Vector2(),
    dragOffset: new THREE.Vector2(0, 0),
    velocity: new THREE.Vector2(0, 0),
    dismissed: false,
    dismissDir: new THREE.Vector2(0, 0),
    dismissProgress: 0,
    enterAnim: 0,         // 0→1 entrance
    enterStartTime: -1,
    bobPhase: Math.random() * Math.PI * 2,
  });

  // Pointer handlers
  const onPointerDown = useCallback((e) => {
    if (!isActive || stateRef.current.dismissed) return;
    e.stopPropagation();
    stateRef.current.dragging = true;
    stateRef.current.dragStart.set(e.point.x, e.point.y);
    stateRef.current.velocity.set(0, 0);
    gl.domElement.style.cursor = 'grabbing';
  }, [isActive, gl]);

  const onPointerMove = useCallback((e) => {
    if (!stateRef.current.dragging || !isActive) return;
    e.stopPropagation();
    const dx = e.point.x - stateRef.current.dragStart.x;
    const dy = e.point.y - stateRef.current.dragStart.y;
    stateRef.current.velocity.set(
      dx - stateRef.current.dragOffset.x,
      dy - stateRef.current.dragOffset.y
    );
    stateRef.current.dragOffset.set(dx, dy);
  }, [isActive]);

  const onPointerUp = useCallback((e) => {
    if (!isActive) return;
    e.stopPropagation();
    const s = stateRef.current;
    s.dragging = false;
    gl.domElement.style.cursor = 'grab';

    const dist = s.dragOffset.length();

    if (dist < 0.15 && !s.flipped) {
      // Small click → flip the card
      s.flipped = true;
      if (onFlip) onFlip();
    } else if (dist > SWIPE_THRESHOLD && s.flipped) {
      // Swipe away
      s.dismissed = true;
      s.dismissDir.copy(s.dragOffset).normalize();
      if (onSwiped) setTimeout(onSwiped, 400);
    } else {
      // Snap back
      s.dragOffset.set(0, 0);
    }
    s.velocity.set(0, 0);
  }, [isActive, onFlip, onSwiped, gl]);

  // Missed pointer up (released outside card)
  useEffect(() => {
    const handleUp = () => {
      const s = stateRef.current;
      if (s.dragging) {
        s.dragging = false;
        gl.domElement.style.cursor = 'default';
        const dist = s.dragOffset.length();
        if (dist > SWIPE_THRESHOLD && s.flipped) {
          s.dismissed = true;
          s.dismissDir.copy(s.dragOffset).normalize();
          if (onSwiped) setTimeout(onSwiped, 400);
        } else if (dist < 0.15 && !s.flipped) {
          s.flipped = true;
          if (onFlip) onFlip();
        } else {
          s.dragOffset.set(0, 0);
        }
        s.velocity.set(0, 0);
      }
    };
    gl.domElement.addEventListener('pointerup', handleUp);
    return () => gl.domElement.removeEventListener('pointerup', handleUp);
  }, [gl, onFlip, onSwiped]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    const t = state.clock.elapsedTime;

    // Entrance animation
    if (s.enterStartTime < 0) s.enterStartTime = t;
    const enterElapsed = t - s.enterStartTime;
    s.enterAnim = Math.min(1, enterElapsed / 0.5);
    const enterEase = 1 - Math.pow(1 - s.enterAnim, 3);

    // Flip animation (smooth lerp)
    const flipTarget = s.flipped ? 0 : 1;
    s.flipAnim += (flipTarget - s.flipAnim) * 0.1;

    // Dismiss animation
    if (s.dismissed) {
      s.dismissProgress += delta * 3;
      const dp = Math.min(s.dismissProgress, 1);
      const flyDist = 12 * dp;
      groupRef.current.position.x = s.dismissDir.x * flyDist;
      groupRef.current.position.y = s.dismissDir.y * flyDist;
      groupRef.current.rotation.z = s.dismissDir.x * dp * 0.8;
      groupRef.current.scale.setScalar(Math.max(0, 1 - dp * 0.5));
      // Keep flip rotation
      groupRef.current.rotation.y = s.flipAnim * Math.PI;
      return;
    }

    // Position: drag offset + snap back + entrance
    if (!s.dragging) {
      s.dragOffset.x *= 0.85;
      s.dragOffset.y *= 0.85;
    }

    const entranceY = (1 - enterEase) * -3;
    const entranceScale = 0.5 + enterEase * 0.5;

    // Gentle bob
    const bob = Math.sin(t * 0.8 + s.bobPhase) * 0.06 * enterEase;

    groupRef.current.position.x = s.dragOffset.x;
    groupRef.current.position.y = s.dragOffset.y + bob + entranceY;
    groupRef.current.scale.setScalar(entranceScale);

    // Tilt based on drag
    const tiltX = -s.dragOffset.y * 0.08;
    const tiltZ = -s.dragOffset.x * 0.06;
    groupRef.current.rotation.x = tiltX;
    groupRef.current.rotation.y = s.flipAnim * Math.PI;
    groupRef.current.rotation.z = tiltZ;
  });

  // Swipe direction indicator opacity
  const dragDist = stateRef.current.dragOffset.length();
  const swipeOpacity = Math.min(1, dragDist / SWIPE_THRESHOLD) * 0.3;

  return (
    <group ref={groupRef}>
      <mesh
        geometry={cardGeo}
        material={materials}
        position={[0, 0, -CARD_D / 2]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Rarity glow */}
      {isHighRarity && (
        <pointLight
          position={[0, 0, 0.4]}
          intensity={rarity === 'ultra-legendary' ? 2.5 : rarity === 'legendary' ? 1.8 : 1}
          color={glowColor}
          distance={5}
        />
      )}
      <pointLight position={[0, 0, -0.3]} intensity={0.3} color={glowColor} distance={3} />

      {/* Sparkles for legendary+ */}
      {isHighRarity && stateRef.current.flipped && (
        <Sparkles count={30} scale={[4, 5, 2]} size={2} speed={0.5} color={glowColor} />
      )}

      {/* Drag direction glow indicator */}
      {stateRef.current.dragging && dragDist > 0.3 && (
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[CARD_W + 1, CARD_H + 1]} />
          <meshBasicMaterial color={glowColor} transparent opacity={swipeOpacity} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ─── Hint text overlay in 3D ────────────────────────────

function HintText({ text, visible }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) {
      ref.current.material.opacity = visible ? 0.6 : 0;
    }
  });
  // We won't render 3D text, hints are in the HTML overlay
  return null;
}

// ─── Main scene ─────────────────────────────────────────

function RevealScene({ sortedCards, onAllRevealed }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [swipedCards, setSwipedCards] = useState(new Set());

  // State communicated back to parent for UI overlay
  const currentCard = sortedCards[currentIndex];
  const isCurrentFlipped = flippedCards.has(currentIndex);

  // Expose state to parent via callback
  useEffect(() => {
    if (window._revealStateCallback) {
      window._revealStateCallback({
        currentIndex,
        isFlipped: isCurrentFlipped,
        total: sortedCards.length,
        swipedCount: swipedCards.size,
      });
    }
  }, [currentIndex, isCurrentFlipped, swipedCards.size, sortedCards.length]);

  const handleFlip = useCallback(() => {
    setFlippedCards(prev => new Set(prev).add(currentIndex));
  }, [currentIndex]);

  const handleSwiped = useCallback(() => {
    setSwipedCards(prev => {
      const next = new Set(prev).add(currentIndex);
      return next;
    });
    if (currentIndex + 1 < sortedCards.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      if (onAllRevealed) onAllRevealed();
    }
  }, [currentIndex, sortedCards.length, onAllRevealed]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 6]} intensity={1.2} />
      <directionalLight position={[-3, -2, 4]} intensity={0.3} />

      {/* Render current card and next card (peek behind) */}
      {sortedCards.map((card, i) => {
        if (swipedCards.has(i)) return null;
        if (i > currentIndex + 1) return null; // only show current + next

        const isCurrent = i === currentIndex;
        const zOffset = isCurrent ? 0 : -0.2;
        const scaleOffset = isCurrent ? 1 : 0.92;

        return (
          <group key={`${card.id || i}-${i}`} position={[0, 0, zOffset]} scale={scaleOffset}>
            <SwipeableCard
              card={card}
              isActive={isCurrent}
              onFlip={isCurrent ? handleFlip : undefined}
              onSwiped={isCurrent ? handleSwiped : undefined}
              enterFrom="bottom"
            />
          </group>
        );
      })}

      {/* Background particles */}
      <Sparkles
        count={20}
        scale={[10, 10, 5]}
        size={1}
        speed={0.2}
        opacity={0.3}
        color="#8b5cf6"
      />
    </>
  );
}

// ─── Main component ─────────────────────────────────────

function CardReveal({ cards, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [revealState, setRevealState] = useState({
    currentIndex: 0,
    isFlipped: false,
    total: 0,
    swipedCount: 0,
  });

  const sortedCards = [...(cards || [])].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );

  // State bridge from 3D scene
  useEffect(() => {
    window._revealStateCallback = setRevealState;
    return () => { window._revealStateCallback = null; };
  }, []);

  // Dismiss intro
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => setShowIntro(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const handleAllRevealed = useCallback(() => {
    setTimeout(() => setShowAll(true), 600);
  }, []);

  const handleSkipAll = () => setShowAll(true);

  const currentCard = sortedCards[revealState.currentIndex];
  const currentRarity = currentCard?.rarity || 'common';

  // ── Summary screen ──
  if (showAll) {
    return (
      <div className="card-reveal-overlay" onClick={onClose}>
        <div className="card-reveal-summary" onClick={e => e.stopPropagation()}>
          <h2 className="reveal-summary-title">Vos nouvelles cartes !</h2>
          <div className="reveal-summary-grid">
            {sortedCards.map((card, i) => (
              <div key={i} className={`reveal-summary-card rarity-glow--${card.rarity}`}>
                <CardMini3D card={card} size="medium" />
                <span className={`reveal-rarity-label rarity-text--${card.rarity}`}>
                  {RARITY_LABELS[card.rarity] || card.rarity}
                </span>
                {card.isNew && <span className="reveal-new-badge">NEW</span>}
              </div>
            ))}
          </div>
          <button className="reveal-close-btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  // ── Intro screen ──
  if (showIntro) {
    return (
      <div className="card-reveal-overlay">
        <div className="reveal-intro">
          <div className="reveal-intro-icon">&#128230;</div>
          <h2>Booster ouvert !</h2>
          <p>{sortedCards.length} carte{sortedCards.length > 1 ? 's' : ''} a decouvrir</p>
        </div>
      </div>
    );
  }

  // ── Main 3D reveal ──
  return (
    <div className={`card-reveal-overlay rarity-bg--${currentRarity}`}>
      {/* Skip button */}
      <button className="reveal-skip-btn" onClick={handleSkipAll}>
        Tout reveler ({sortedCards.length - revealState.swipedCount} restante{sortedCards.length - revealState.swipedCount > 1 ? 's' : ''})
      </button>

      {/* Full-screen 3D Canvas */}
      <div className="card-reveal-canvas">
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', touchAction: 'none' }}
        >
          <Suspense fallback={null}>
            <RevealScene
              sortedCards={sortedCards}
              onAllRevealed={handleAllRevealed}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Overlay UI — hints and card info */}
      <div className="card-reveal-ui-overlay">
        {/* Hint */}
        {!revealState.isFlipped && (
          <div className="reveal-hint reveal-hint--flip">
            Cliquez sur la carte pour la retourner
          </div>
        )}
        {revealState.isFlipped && (
          <div className="reveal-hint reveal-hint--swipe">
            Glissez la carte pour voir la suivante
          </div>
        )}

        {/* Card name + rarity when flipped */}
        {revealState.isFlipped && currentCard && (
          <div className="reveal-card-label">
            <span className="reveal-card-name">{currentCard.name}</span>
            <span className={`reveal-rarity-tag rarity-text--${currentRarity}`}>
              {RARITY_LABELS[currentRarity]}
            </span>
            {currentCard.isNew && <span className="reveal-new-tag">NOUVELLE !</span>}
          </div>
        )}

        {/* Counter */}
        <div className="reveal-counter">
          {revealState.swipedCount + 1} / {sortedCards.length}
        </div>
      </div>

      {/* Progress dots */}
      <div className="reveal-progress">
        {sortedCards.map((card, i) => (
          <div
            key={i}
            className={`reveal-dot ${i === revealState.currentIndex ? 'active' : ''} ${i < revealState.swipedCount ? 'done' : ''} rarity-dot--${card.rarity}`}
          />
        ))}
      </div>
    </div>
  );
}

export default CardReveal;
