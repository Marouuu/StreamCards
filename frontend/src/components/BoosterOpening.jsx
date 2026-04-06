import { Suspense, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import Booster3D from './Booster3D';
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
  const baseNote = 523.25;
  const notes = [0, 2, 4, 5, 7];
  osc.frequency.value = baseNote * Math.pow(2, (notes[index % 5]) / 12);
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.3);

  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    d[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
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
    [523, 659, 784], [587, 740, 880],
    [659, 784, 988], [784, 988, 1175],
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

// ── Rarity constants ──
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'];
const RARITY_LABELS = {
  common: 'Commune', uncommon: 'Peu commune', rare: 'Rare',
  epic: 'Epique', legendary: 'Legendaire', 'ultra-legendary': 'Ultra Legendaire',
};
const RARITY_COLORS = {
  common: '#a0a0a0', uncommon: '#2ecc40', rare: '#0096ff',
  epic: '#9600ff', legendary: '#ffd700', 'ultra-legendary': '#ff00ff',
};

const CARD_W = 2.5;
const CARD_H = 3.5;
const CARD_D = 0.03;
const CORNER_R = 0.12;
const SWIPE_THRESHOLD = 1.5;

// ── Texture hooks ──
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

function useCardBackTexture(rarity) {
  return useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 716;
    const ctx = canvas.getContext('2d');
    const color = RARITY_COLORS[rarity] || RARITY_COLORS.common;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, 512, 716);

    const glow = ctx.createRadialGradient(256, 358, 0, 256, 358, 350);
    glow.addColorStop(0, color + '30');
    glow.addColorStop(0.5, color + '10');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 716);

    ctx.globalAlpha = 0.06;
    for (let py = 0; py < 716; py += 40) {
      for (let px = 0; px < 512; px += 40) {
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

    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.roundRect(12, 12, 488, 692, 20); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(256, 338);
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fillStyle = color + '15'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.4; ctx.stroke();
    ctx.globalAlpha = 0.6; ctx.fillStyle = color;
    ctx.font = 'bold 52px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SC', 0, 0);
    ctx.restore();

    ctx.fillStyle = color; ctx.globalAlpha = 0.3;
    ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
    ctx.fillText('STREAMCARDS', 256, 676);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  })[0];
}

// Draws a full card face (border, image, name, rarity) onto a canvas texture
function useCardFrontTexture(card) {
  const [texture, setTexture] = useState(null);
  const cardRef = useRef(card);
  cardRef.current = card;

  useEffect(() => {
    const c = cardRef.current;
    const rarity = c?.rarity || 'common';
    const outlineColor = c?.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
    const bgColor = c?.background_color || '#1a1a2e';
    const textColor = c?.text_color || '#ffffff';
    const name = c?.name || 'Card';
    const description = c?.description || '';
    const creatorName = c?.creator_display_name || c?.creator_name || '';

    const W = 512, H = 716;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    function drawCard(img) {
      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Outer border (rarity colored)
      const borderW = 10;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = borderW;
      ctx.beginPath();
      ctx.roundRect(borderW / 2, borderW / 2, W - borderW, H - borderW, 16);
      ctx.stroke();

      // Inner border glow
      ctx.strokeStyle = outlineColor + '40';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(borderW + 4, borderW + 4, W - (borderW + 4) * 2, H - (borderW + 4) * 2, 12);
      ctx.stroke();

      // Image area
      const imgX = 24, imgY = 24;
      const imgW = W - 48, imgH = H * 0.6;

      if (img) {
        // Draw image with cover-fit (crop to fill)
        const imgAspect = img.width / img.height;
        const areaAspect = imgW / imgH;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgAspect > areaAspect) {
          // Image wider than area — crop sides
          sw = img.height * areaAspect;
          sx = (img.width - sw) / 2;
        } else {
          // Image taller — crop top/bottom
          sh = img.width / areaAspect;
          sy = (img.height - sh) / 2;
        }
        // Clip to rounded rect
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgW, imgH, 8);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgW, imgH);
        ctx.restore();
      } else {
        // No image placeholder
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgW, imgH, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.font = '64px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\uD83C\uDFB4', W / 2, imgY + imgH / 2);
      }

      // Image border
      ctx.strokeStyle = outlineColor + '60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, 8);
      ctx.stroke();

      // Card name area
      const nameY = imgY + imgH + 16;
      ctx.fillStyle = textColor;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // Truncate name if too long
      let displayName = name;
      while (ctx.measureText(displayName).width > imgW - 20 && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== name) displayName += '...';
      ctx.fillText(displayName, W / 2, nameY);

      // Description (small, under name)
      if (description) {
        ctx.fillStyle = textColor + '99';
        ctx.font = '14px Arial';
        const maxDescW = imgW - 20;
        let desc = description;
        while (ctx.measureText(desc).width > maxDescW && desc.length > 3) {
          desc = desc.slice(0, -1);
        }
        if (desc !== description) desc += '...';
        ctx.fillText(desc, W / 2, nameY + 36);
      }

      // Creator tag (top-left over image)
      if (creatorName) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const tagW = ctx.measureText(creatorName).width;
        ctx.font = 'bold 13px Arial';
        const tw = ctx.measureText(creatorName).width + 16;
        ctx.beginPath();
        ctx.roundRect(imgX + 6, imgY + 6, tw, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(creatorName, imgX + 14, imgY + 17);
        ctx.textAlign = 'center';
      }

      // Rarity badge (bottom)
      const badgeY = H - 50;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(20, badgeY, W - 40, 34);
      ctx.fillStyle = outlineColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rarity.toUpperCase().replace('-', ' '), W / 2, badgeY + 17);

      // Create texture
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    }

    // Load image then draw
    if (c?.image_url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => drawCard(img);
      img.onerror = () => drawCard(null);
      img.src = c.image_url;
    } else {
      drawCard(null);
    }
  }, [card?.image_url, card?.name, card?.rarity, card?.outline_color, card?.background_color]);

  return texture;
}

// No shared geometry needed — using planes + box for reliable texture mapping

// ── Swipeable 3D Card ──
function SwipeableCard({ card, isActive, onFlip, onSwiped }) {
  const groupRef = useRef();
  const { gl } = useThree();
  const rarity = card.rarity || 'common';
  const glowColor = card.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const isHighRarity = ['epic', 'legendary', 'ultra-legendary'].includes(rarity);

  const frontTex = useCardFrontTexture(card);
  const backTex = useCardBackTexture(rarity);

  const stateRef = useRef({
    flipped: false, flipAnim: 1, // starts showing back
    dragging: false, dragStart: new THREE.Vector2(),
    dragOffset: new THREE.Vector2(0, 0),
    dismissed: false, dismissDir: new THREE.Vector2(0, 0), dismissProgress: 0,
    enterAnim: 0, enterStartTime: -1,
    bobPhase: Math.random() * Math.PI * 2,
  });

  const onPointerDown = useCallback((e) => {
    if (!isActive || stateRef.current.dismissed) return;
    e.stopPropagation();
    stateRef.current.dragging = true;
    stateRef.current.dragStart.set(e.point.x, e.point.y);
    gl.domElement.style.cursor = 'grabbing';
  }, [isActive, gl]);

  const onPointerMove = useCallback((e) => {
    if (!stateRef.current.dragging || !isActive) return;
    e.stopPropagation();
    const dx = e.point.x - stateRef.current.dragStart.x;
    const dy = e.point.y - stateRef.current.dragStart.y;
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
      // Click → flip
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
  }, [isActive, onFlip, onSwiped, gl]);

  // Handle pointer up outside card mesh
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
      }
    };
    gl.domElement.addEventListener('pointerup', handleUp);
    return () => gl.domElement.removeEventListener('pointerup', handleUp);
  }, [gl, onFlip, onSwiped]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    const t = state.clock.elapsedTime;

    // Entrance
    if (s.enterStartTime < 0) s.enterStartTime = t;
    const enterElapsed = t - s.enterStartTime;
    s.enterAnim = Math.min(1, enterElapsed / 0.5);
    const enterEase = 1 - Math.pow(1 - s.enterAnim, 3);

    // Flip
    const flipTarget = s.flipped ? 0 : 1;
    s.flipAnim += (flipTarget - s.flipAnim) * 0.1;

    // Dismiss
    if (s.dismissed) {
      s.dismissProgress += delta * 3;
      const dp = Math.min(s.dismissProgress, 1);
      groupRef.current.position.x = s.dismissDir.x * dp * 12;
      groupRef.current.position.y = s.dismissDir.y * dp * 12;
      groupRef.current.rotation.z = s.dismissDir.x * dp * 0.8;
      groupRef.current.rotation.y = s.flipAnim * Math.PI;
      groupRef.current.scale.setScalar(Math.max(0, 1 - dp * 0.5));
      return;
    }

    // Drag snap-back
    if (!s.dragging) {
      s.dragOffset.x *= 0.85;
      s.dragOffset.y *= 0.85;
    }

    const entranceY = (1 - enterEase) * -3;
    const bob = Math.sin(t * 0.8 + s.bobPhase) * 0.06 * enterEase;

    groupRef.current.position.x = s.dragOffset.x;
    groupRef.current.position.y = s.dragOffset.y + bob + entranceY;
    groupRef.current.scale.setScalar(0.5 + enterEase * 0.5);
    groupRef.current.rotation.x = -s.dragOffset.y * 0.08;
    groupRef.current.rotation.y = s.flipAnim * Math.PI;
    groupRef.current.rotation.z = -s.dragOffset.x * 0.06;
  });

  return (
    <group ref={groupRef}>
      {/* Front face — card image (faces +Z, offset to avoid z-fighting) */}
      <mesh position={[0, 0, CARD_D / 2 + 0.002]} renderOrder={1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={frontTex} metalness={isHighRarity ? 0.4 : 0.1} roughness={isHighRarity ? 0.3 : 0.5} />
      </mesh>

      {/* Back face — card back design (faces -Z, offset to avoid z-fighting) */}
      <mesh position={[0, 0, -(CARD_D / 2 + 0.002)]} rotation={[0, Math.PI, 0]} renderOrder={1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={backTex} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Thin edge (gives the card thickness) */}
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <meshStandardMaterial color={glowColor} metalness={0.3} roughness={0.4} />
      </mesh>

      {isHighRarity && (
        <pointLight position={[0, 0, 0.4]}
          intensity={rarity === 'ultra-legendary' ? 2.5 : rarity === 'legendary' ? 1.8 : 1}
          color={glowColor} distance={5} />
      )}
      <pointLight position={[0, 0, -0.3]} intensity={0.3} color={glowColor} distance={3} />
      {isHighRarity && stateRef.current.flipped && (
        <Sparkles count={30} scale={[4, 5, 2]} size={2} speed={0.5} color={glowColor} />
      )}
    </group>
  );
}

// ── Card reveal scene (inside Canvas) ──
function CardRevealScene({ sortedCards, onAllRevealed, onStateChange, audioCtx }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedSet, setFlippedSet] = useState(new Set());
  const [swipedSet, setSwipedSet] = useState(new Set());

  const isFlipped = flippedSet.has(currentIndex);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        currentIndex,
        isFlipped,
        total: sortedCards.length,
        swipedCount: swipedSet.size,
        currentCard: sortedCards[currentIndex],
      });
    }
  }, [currentIndex, isFlipped, swipedSet.size]);

  const handleFlip = useCallback(() => {
    setFlippedSet(prev => new Set(prev).add(currentIndex));
    if (audioCtx) playCardRevealSound(audioCtx, currentIndex);
  }, [currentIndex, audioCtx]);

  const handleSwiped = useCallback(() => {
    setSwipedSet(prev => new Set(prev).add(currentIndex));
    if (currentIndex + 1 < sortedCards.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      if (audioCtx) playFanfareSound(audioCtx);
      if (onAllRevealed) onAllRevealed();
    }
  }, [currentIndex, sortedCards.length, onAllRevealed, audioCtx]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 6]} intensity={1.2} />
      <directionalLight position={[-3, -2, 4]} intensity={0.3} />

      {sortedCards.map((card, i) => {
        if (swipedSet.has(i)) return null;
        if (i > currentIndex + 1) return null;
        const isCurrent = i === currentIndex;
        return (
          <group key={`${card.id || i}-${i}`} position={[0, 0, isCurrent ? 0 : -0.2]} scale={isCurrent ? 1 : 0.92}>
            <SwipeableCard
              card={card}
              isActive={isCurrent}
              onFlip={isCurrent ? handleFlip : undefined}
              onSwiped={isCurrent ? handleSwiped : undefined}
            />
          </group>
        );
      })}

      <Sparkles count={20} scale={[10, 10, 5]} size={1} speed={0.2} opacity={0.3} color="#8b5cf6" />
    </>
  );
}

// ── Recap card (simple 3D preview) ──
function RecapCard3D({ card }) {
  const rarity = card.rarity || 'common';
  const glowColor = RARITY_COLORS[rarity] || '#a0a0a0';
  const frontTex = useCardFrontTexture(card);
  return (
    <group>
      {/* Front */}
      <mesh position={[0, 0, CARD_D / 2 + 0.002]} renderOrder={1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={frontTex} metalness={0.15} roughness={0.5} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0, -(CARD_D / 2 + 0.002)]} rotation={[0, Math.PI, 0]} renderOrder={1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial color="#0d0d1a" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Edge */}
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <meshStandardMaterial color={glowColor} metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ── Main Component ──
function BoosterOpening({ booster, onClose, cards }) {
  const [phase, setPhase] = useState('idle'); // idle, opening, reveal, recap
  const audioCtxRef = useRef(null);
  const [revealState, setRevealState] = useState({
    currentIndex: 0, isFlipped: false, total: 0, swipedCount: 0, currentCard: null,
  });

  const sortedCards = [...(cards || [])].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioContext();
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    return () => { if (audioCtxRef.current) audioCtxRef.current.close(); };
  }, []);

  const handleOpen = () => {
    const ctx = getAudioCtx();
    setPhase('opening');
    playShakeSound(ctx);
    setTimeout(() => playTearSound(ctx), 800);
    // Transition to card reveal after booster animation
    setTimeout(() => setPhase('reveal'), 2800);
  };

  const handleAllRevealed = useCallback(() => {
    setTimeout(() => setPhase('recap'), 600);
  }, []);

  const handleSkipAll = () => setPhase('recap');

  const currentCard = revealState.currentCard || sortedCards[0];
  const currentRarity = currentCard?.rarity || 'common';

  const raritySummary = {};
  if (cards) {
    for (const card of cards) {
      const r = card.rarity || 'common';
      raritySummary[r] = (raritySummary[r] || 0) + 1;
    }
  }

  const isOpening = phase === 'opening';

  return (
    <div className="booster-opening-overlay">
      <div className="booster-opening-container">

        {/* ── IDLE: Show booster + open button ── */}
        {phase === 'idle' && (
          <>
            <button className="close-opening-btn" onClick={onClose}>&#10005;</button>
            <h2 className="opening-title">{booster?.name || 'Booster Pack'}</h2>
            <div className="booster-canvas-container">
              <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ alpha: true, antialias: true, toneMapping: 3 }}>
                <PerspectiveCamera makeDefault position={[0, 0, 7]} />
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 8, 5]} intensity={1.2} />
                <directionalLight position={[-5, -3, 5]} intensity={0.4} />
                <pointLight position={[0, 0, 4]} intensity={0.8} color="#ffffff" />
                <Suspense fallback={null}>
                  <Booster3D
                    isOpening={false}
                    rarity={booster?.rarity || 'common'}
                    name={booster?.name}
                    imageUrl={booster?.image_url || booster?.imageUrl || null}
                    colorPrimary={booster?.color_primary || null}
                    colorAccent={booster?.color_accent || null}
                    colorText={booster?.color_text || null}
                    colorBackground={booster?.color_background || null}
                  />
                </Suspense>
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.5}
                  maxPolarAngle={Math.PI * 0.65} minPolarAngle={Math.PI * 0.35} />
              </Canvas>
            </div>
            <button className="open-booster-btn" onClick={handleOpen}>Ouvrir le booster</button>
          </>
        )}

        {/* ── OPENING: Booster tear animation ── */}
        {phase === 'opening' && (
          <>
            <h2 className="opening-title">{booster?.name || 'Booster Pack'}</h2>
            <div className="booster-canvas-container">
              <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ alpha: true, antialias: true, toneMapping: 3 }}>
                <PerspectiveCamera makeDefault position={[0, 0, 7]} />
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 8, 5]} intensity={1.2} />
                <directionalLight position={[-5, -3, 5]} intensity={0.4} />
                <pointLight position={[0, 0, 4]} intensity={0.8} color="#ffffff" />
                <Suspense fallback={null}>
                  <Booster3D
                    isOpening={true}
                    rarity={booster?.rarity || 'common'}
                    name={booster?.name}
                    imageUrl={booster?.image_url || booster?.imageUrl || null}
                    colorPrimary={booster?.color_primary || null}
                    colorAccent={booster?.color_accent || null}
                    colorText={booster?.color_text || null}
                    colorBackground={booster?.color_background || null}
                    onOpenComplete={() => {}}
                  />
                </Suspense>
              </Canvas>
            </div>
          </>
        )}

        {/* ── REVEAL: 3D card swipe experience ── */}
        {phase === 'reveal' && sortedCards.length > 0 && (
          <div className={`card-reveal-fullscreen rarity-bg--${currentRarity}`}>
            <button className="reveal-skip-btn" onClick={handleSkipAll}>
              Tout reveler ({sortedCards.length - revealState.swipedCount} restante{sortedCards.length - revealState.swipedCount > 1 ? 's' : ''})
            </button>

            <div className="card-reveal-canvas-full">
              <Canvas
                camera={{ position: [0, 0, 5.5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent', touchAction: 'none' }}
              >
                <Suspense fallback={null}>
                  <CardRevealScene
                    sortedCards={sortedCards}
                    onAllRevealed={handleAllRevealed}
                    onStateChange={setRevealState}
                    audioCtx={audioCtxRef.current}
                  />
                </Suspense>
              </Canvas>
            </div>

            {/* Overlay hints */}
            <div className="card-reveal-ui">
              {!revealState.isFlipped && (
                <div className="reveal-hint reveal-hint--flip">Cliquez sur la carte pour la retourner</div>
              )}
              {revealState.isFlipped && (
                <div className="reveal-hint reveal-hint--swipe">Glissez la carte pour voir la suivante</div>
              )}

              {revealState.isFlipped && currentCard && (
                <div className="reveal-card-label">
                  <span className="reveal-card-name">{currentCard.name}</span>
                  <span className={`reveal-rarity-tag rarity-text--${currentRarity}`}>
                    {RARITY_LABELS[currentRarity]}
                  </span>
                  {currentCard.isNew && <span className="reveal-new-tag">NOUVELLE !</span>}
                </div>
              )}

              <div className="reveal-counter">
                {Math.min(revealState.swipedCount + 1, sortedCards.length)} / {sortedCards.length}
              </div>
            </div>

            {/* Progress dots */}
            <div className="reveal-progress">
              {sortedCards.map((card, i) => (
                <div key={i}
                  className={`reveal-dot ${i === revealState.currentIndex ? 'active' : ''} ${i < revealState.swipedCount ? 'done' : ''} rarity-dot--${card.rarity}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── RECAP: Summary of all cards ── */}
        {phase === 'recap' && cards && (
          <div className="opened-cards-recap">
            <h3>Cartes obtenues !</h3>

            <div className="cards-reveal-grid">
              {sortedCards.map((card, index) => (
                <div key={index} className="card-reveal-wrapper" style={{ animationDelay: `${index * 0.1}s` }}>
                  {card.isNew === false && <span className="card-badge card-badge--duplicate">DOUBLON</span>}
                  {card.isNew === true && <span className="card-badge card-badge--new">NEW</span>}
                  <div className="recap-card-3d-container">
                    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ antialias: true, alpha: true }}
                      style={{ background: 'transparent' }}>
                      <ambientLight intensity={0.6} />
                      <directionalLight position={[2, 3, 4]} intensity={1} />
                      <Suspense fallback={null}>
                        <RecapCard3D card={card} />
                      </Suspense>
                    </Canvas>
                  </div>
                  <span className={`recap-card-name rarity-text--${card.rarity}`}>
                    {card.name || 'Card'}
                  </span>
                  <span className={`recap-card-rarity`}>
                    {(card.rarity || 'common').toUpperCase().replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>

            <div className="recap-summary">
              {RARITY_ORDER.filter(r => raritySummary[r]).map(r => (
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
