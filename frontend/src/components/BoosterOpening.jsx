import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
// Swipe threshold for flip-to-reveal is defined inline in FlippableCard

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

// Helper: draw full card design onto a canvas context
function drawCardDesign(ctx, W, H, card, img) {
  const rarity = card?.rarity || 'common';
  const outlineColor = card?.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const bgColor = card?.background_color || '#1a1a2e';
  const textColor = card?.text_color || '#ffffff';
  const name = card?.name || 'Card';
  const description = card?.description || '';
  const creatorName = card?.creator_display_name || card?.creator_name || '';

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(5, 5, W - 10, H - 10, 16);
  ctx.stroke();

  ctx.strokeStyle = outlineColor + '40';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 12);
  ctx.stroke();

  const imgX = 24, imgY = 24;
  const imgW = W - 48, imgH = H * 0.6;

  if (img) {
    const imgAspect = img.width / img.height;
    const areaAspect = imgW / imgH;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > areaAspect) {
      sw = img.height * areaAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / areaAspect;
      sy = (img.height - sh) / 2;
    }
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgW, imgH, 8);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgW, imgH);
    ctx.restore();
  } else {
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

  ctx.strokeStyle = outlineColor + '60';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgW, imgH, 8);
  ctx.stroke();

  const nameY = imgY + imgH + 16;
  ctx.fillStyle = textColor;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let displayName = name;
  while (ctx.measureText(displayName).width > imgW - 20 && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== name) displayName += '...';
  ctx.fillText(displayName, W / 2, nameY);

  if (description) {
    ctx.fillStyle = textColor + '99';
    ctx.font = '14px Arial';
    let desc = description;
    while (ctx.measureText(desc).width > imgW - 20 && desc.length > 3) {
      desc = desc.slice(0, -1);
    }
    if (desc !== description) desc += '...';
    ctx.fillText(desc, W / 2, nameY + 36);
  }

  if (creatorName) {
    ctx.font = 'bold 13px Arial';
    const tw = ctx.measureText(creatorName).width + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(imgX + 6, imgY + 6, tw, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(creatorName, imgX + 14, imgY + 17);
    ctx.textAlign = 'center';
  }

  const badgeY = H - 50;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(20, badgeY, W - 40, 34);
  ctx.fillStyle = outlineColor;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rarity.toUpperCase().replace('-', ' '), W / 2, badgeY + 17);
}

// Creates texture synchronously (never null), then updates when image loads
function useCardFrontTexture(card) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);

  if (!canvasRef.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  // Draw card design synchronously (without image) so texture is never blank
  useMemo(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawCardDesign(ctx, 512, 716, card, null);
    textureRef.current.needsUpdate = true;
  }, [card?.name, card?.rarity, card?.outline_color, card?.background_color, card?.text_color]);

  // Load image asynchronously, then redraw with it
  useEffect(() => {
    if (!card?.image_url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawCardDesign(ctx, 512, 716, card, img);
      textureRef.current.needsUpdate = true;
    };
    img.src = card.image_url;
  }, [card?.image_url, card?.name, card?.rarity, card?.outline_color, card?.background_color]);

  return textureRef.current;
}

// No shared geometry needed — using planes + box for reliable texture mapping

// ── Sound effects for rare cards ──
function playRareAnticipationSound(ctx, rarity) {
  const time = ctx.currentTime;
  const isLeg = rarity === 'legendary' || rarity === 'ultra-legendary';

  // Rising sweep — builds tension
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(isLeg ? 80 : 120, time);
  osc.frequency.exponentialRampToValueAtTime(isLeg ? 800 : 500, time + (isLeg ? 1.2 : 0.8));
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(isLeg ? 0.12 : 0.08, time + 0.2);
  gain.gain.setValueAtTime(isLeg ? 0.12 : 0.08, time + (isLeg ? 1.0 : 0.6));
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isLeg ? 1.3 : 0.9));
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, time);
  lp.frequency.exponentialRampToValueAtTime(4000, time + (isLeg ? 1.2 : 0.8));
  osc.connect(lp).connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + (isLeg ? 1.4 : 1.0));

  // Sub bass rumble
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.value = 50;
  subGain.gain.setValueAtTime(0, time);
  subGain.gain.linearRampToValueAtTime(isLeg ? 0.15 : 0.08, time + 0.3);
  subGain.gain.exponentialRampToValueAtTime(0.001, time + (isLeg ? 1.3 : 0.9));
  sub.connect(subGain).connect(ctx.destination);
  sub.start(time);
  sub.stop(time + 1.4);
}

function playRareRevealSound(ctx, rarity) {
  const time = ctx.currentTime;
  const isUltra = rarity === 'ultra-legendary';
  const isLeg = rarity === 'legendary' || isUltra;

  // Impact hit
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(isLeg ? 0.2 : 0.12, time);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  noise.connect(nGain).connect(ctx.destination);
  noise.start(time);

  // Bright chord stab
  const notes = isUltra ? [523, 659, 784, 1047] : isLeg ? [440, 554, 659] : [523, 659];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(isLeg ? 0.15 : 0.1, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isLeg ? 1.5 : 0.8));
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 1.6);
  });

  // Shimmering tail for legendary+
  if (isLeg) {
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200 + i * 400 + Math.random() * 200;
      const t = time + 0.1 + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    }
  }
}

// ── Flippable 3D Card ──
// Swipe left/right to flip, swipe again when flipped to go to next card
const SWIPE_FLIP_THRESHOLD = 0.4;

function FlippableCard({ card, isActive, isNextInStack, onFlip, onNext, audioCtx }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const { gl } = useThree();
  const rarity = card.rarity || 'common';
  const glowColor = card.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const isHighRarity = ['epic', 'legendary', 'ultra-legendary'].includes(rarity);
  const isRareOrAbove = ['rare', 'epic', 'legendary', 'ultra-legendary'].includes(rarity);

  const frontTex = useCardFrontTexture(card);
  const backTex = useCardBackTexture(rarity);

  const stateRef = useRef({
    flipped: false, flipAnim: 1, // starts showing back (1 = back, 0 = front)
    dragging: false, dragStartX: 0,
    dragOffsetX: 0,
    leaving: false, leaveDir: 0, leaveProgress: 0,
    // No entrance animation — cards are already positioned in the stack
    bobPhase: Math.random() * Math.PI * 2,
    showSparkles: false,
    // Rare card effects
    anticipation: false, anticipationStart: -1,
    revealed: false, revealFlashProgress: 0,
    glowIntensity: 0,
    shakeIntensity: 0,
  });

  const handleAction = useCallback((dx) => {
    const s = stateRef.current;
    const absDx = Math.abs(dx);

    if (absDx < 0.1) return; // too small, ignore

    if (!s.flipped) {
      if (isRareOrAbove && !s.anticipation) {
        // Start anticipation phase for rare+ cards
        s.anticipation = true;
        s.anticipationStart = -1; // will be set in useFrame
        if (audioCtx) playRareAnticipationSound(audioCtx, rarity);
        // Delay the actual flip
        const delay = (rarity === 'legendary' || rarity === 'ultra-legendary') ? 1200 : 800;
        setTimeout(() => {
          s.flipped = true;
          s.revealed = true;
          s.showSparkles = isHighRarity;
          s.anticipation = false;
          if (audioCtx) playRareRevealSound(audioCtx, rarity);
          if (onFlip) onFlip();
        }, delay);
      } else if (!isRareOrAbove) {
        // Instant flip for common/uncommon
        s.flipped = true;
        s.showSparkles = false;
        if (onFlip) onFlip();
      }
      // If anticipation is already running, ignore additional swipes
    } else {
      // Already flipped: swipe to next card
      if (absDx > SWIPE_FLIP_THRESHOLD) {
        s.leaving = true;
        s.leaveDir = dx > 0 ? 1 : -1;
        if (onNext) setTimeout(onNext, 350);
      }
    }
  }, [onFlip, onNext, isHighRarity, isRareOrAbove, rarity, audioCtx]);

  const onPointerDown = useCallback((e) => {
    if (!isActive || stateRef.current.leaving) return;
    e.stopPropagation();
    stateRef.current.dragging = true;
    stateRef.current.dragStartX = e.point.x;
    stateRef.current.dragOffsetX = 0;
    gl.domElement.style.cursor = 'grabbing';
  }, [isActive, gl]);

  const onPointerMove = useCallback((e) => {
    if (!stateRef.current.dragging || !isActive) return;
    e.stopPropagation();
    stateRef.current.dragOffsetX = e.point.x - stateRef.current.dragStartX;
  }, [isActive]);

  const onPointerUp = useCallback((e) => {
    if (!isActive || !stateRef.current.dragging) return;
    e.stopPropagation();
    stateRef.current.dragging = false;
    gl.domElement.style.cursor = 'grab';
    handleAction(stateRef.current.dragOffsetX);
    if (!stateRef.current.leaving) stateRef.current.dragOffsetX = 0;
  }, [isActive, gl, handleAction]);

  useEffect(() => {
    const handleUp = () => {
      const s = stateRef.current;
      if (s.dragging) {
        s.dragging = false;
        gl.domElement.style.cursor = 'default';
        handleAction(s.dragOffsetX);
        if (!s.leaving) s.dragOffsetX = 0;
      }
    };
    gl.domElement.addEventListener('pointerup', handleUp);
    return () => gl.domElement.removeEventListener('pointerup', handleUp);
  }, [gl, handleAction]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    const t = state.clock.elapsedTime;

    // Flip lerp
    const flipTarget = s.flipped ? 0 : 1;
    s.flipAnim += (flipTarget - s.flipAnim) * 0.12;

    // Leave animation
    if (s.leaving) {
      s.leaveProgress += delta * 3.5;
      const lp = Math.min(s.leaveProgress, 1);
      const eased = 1 - Math.pow(1 - lp, 2);
      groupRef.current.position.x = s.leaveDir * eased * 8;
      groupRef.current.rotation.y = s.flipAnim * Math.PI;
      groupRef.current.rotation.z = s.leaveDir * eased * 0.3;
      groupRef.current.scale.setScalar(Math.max(0.3, 1 - eased * 0.5));
      groupRef.current.position.y = 0;
      return;
    }

    // Anticipation phase — screen shake + glow buildup
    if (s.anticipation) {
      if (s.anticipationStart < 0) s.anticipationStart = t;
      const elapsed = t - s.anticipationStart;
      const isLeg = rarity === 'legendary' || rarity === 'ultra-legendary';
      const duration = isLeg ? 1.2 : 0.8;
      const progress = Math.min(elapsed / duration, 1);

      // Increasing shake
      s.shakeIntensity = progress * (isLeg ? 0.08 : 0.04);
      const shakeX = Math.sin(t * 60) * s.shakeIntensity;
      const shakeY = Math.cos(t * 45) * s.shakeIntensity * 0.5;

      // Glow buildup
      s.glowIntensity = progress * (isLeg ? 8 : 4);

      const bob = Math.sin(t * 0.8 + s.bobPhase) * 0.04;
      groupRef.current.position.x = shakeX;
      groupRef.current.position.y = bob + shakeY;
      groupRef.current.scale.setScalar(1 + progress * 0.05); // slight scale up
      groupRef.current.rotation.y = s.flipAnim * Math.PI;
      groupRef.current.rotation.z = Math.sin(t * 50) * s.shakeIntensity * 0.3;

      if (glowRef.current) glowRef.current.intensity = s.glowIntensity;
      return;
    }

    // Post-reveal flash
    if (s.revealed && s.revealFlashProgress < 1) {
      s.revealFlashProgress += delta * 2;
      s.glowIntensity = Math.max(0, (1 - s.revealFlashProgress) * 10);
      if (glowRef.current) glowRef.current.intensity = s.glowIntensity;
    } else if (!s.revealed) {
      s.glowIntensity = 0;
      if (glowRef.current) glowRef.current.intensity = 0;
    }

    // Drag snap-back
    if (!s.dragging) {
      s.dragOffsetX *= 0.85;
    }

    const bob = Math.sin(t * 0.8 + s.bobPhase) * 0.04;

    groupRef.current.position.x = s.dragOffsetX * 0.5;
    groupRef.current.position.y = bob;
    groupRef.current.scale.setScalar(1);
    groupRef.current.rotation.y = s.flipAnim * Math.PI;
    groupRef.current.rotation.z = -s.dragOffsetX * 0.04;
  });

  // Determine sparkle settings based on state
  const showAnticipationFx = stateRef.current.anticipation;
  const showRevealFx = stateRef.current.revealed;

  return (
    <group ref={groupRef}>
      {/* Front face */}
      <mesh position={[0, 0, CARD_D / 2 + 0.002]} renderOrder={1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={frontTex} metalness={isHighRarity ? 0.4 : 0.1} roughness={isHighRarity ? 0.3 : 0.5} />
      </mesh>

      {/* Back face */}
      <mesh position={[0, 0, -(CARD_D / 2 + 0.002)]} rotation={[0, Math.PI, 0]} renderOrder={1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={backTex} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Edge */}
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <meshStandardMaterial color={glowColor} metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Dynamic glow light — used for anticipation buildup + reveal flash */}
      {isRareOrAbove && (
        <pointLight ref={glowRef} position={[0, 0, 0.6]} intensity={0} color={glowColor} distance={8} />
      )}

      {/* Base glow for high rarity */}
      {isHighRarity && (
        <pointLight position={[0, 0, 0.4]}
          intensity={rarity === 'ultra-legendary' ? 2.5 : rarity === 'legendary' ? 1.8 : 1}
          color={glowColor} distance={5} />
      )}
      <pointLight position={[0, 0, -0.3]} intensity={0.3} color={glowColor} distance={3} />

      {/* Anticipation sparkles — build up before flip */}
      {isRareOrAbove && (
        <Sparkles
          count={rarity === 'ultra-legendary' ? 80 : rarity === 'legendary' ? 60 : rarity === 'epic' ? 40 : 25}
          scale={[CARD_W + 1, CARD_H + 1, 2]}
          size={rarity === 'ultra-legendary' ? 4 : rarity === 'legendary' ? 3 : 2}
          speed={isHighRarity ? 2 : 1}
          opacity={0.8}
          color={glowColor}
        />
      )}

      {/* Post-reveal explosion of sparkles */}
      {isHighRarity && showRevealFx && (
        <>
          <Sparkles count={100} scale={[6, 7, 4]} size={5} speed={3} opacity={1} color={glowColor} />
          <Sparkles count={50} scale={[8, 9, 5]} size={3} speed={1.5} opacity={0.6} color="#ffffff" />
        </>
      )}
    </group>
  );
}

// ── Card reveal scene (inside Canvas) ──
function CardRevealScene({ sortedCards, onAllRevealed, onStateChange, audioCtx }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedSet, setFlippedSet] = useState(new Set());
  const [doneSet, setDoneSet] = useState(new Set());

  const isFlipped = flippedSet.has(currentIndex);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        currentIndex,
        isFlipped,
        total: sortedCards.length,
        swipedCount: doneSet.size,
        currentCard: sortedCards[currentIndex],
      });
    }
  }, [currentIndex, isFlipped, doneSet.size]);

  const handleFlip = useCallback(() => {
    setFlippedSet(prev => new Set(prev).add(currentIndex));
    if (audioCtx) playCardRevealSound(audioCtx, currentIndex);
  }, [currentIndex, audioCtx]);

  const handleNext = useCallback(() => {
    setDoneSet(prev => new Set(prev).add(currentIndex));
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
        if (doneSet.has(i)) return null;
        if (i > currentIndex + 1) return null;
        const isCurrent = i === currentIndex;
        const isNext = i === currentIndex + 1;
        return (
          <group key={`${card.id || i}-${i}`} position={[0, 0, isCurrent ? 0 : -0.2]} scale={isCurrent ? 1 : 0.92}>
            <FlippableCard
              card={card}
              isActive={isCurrent}
              isNextInStack={isNext}
              onFlip={isCurrent ? handleFlip : undefined}
              onNext={isCurrent ? handleNext : undefined}
              audioCtx={audioCtx}
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
                camera={{ position: [0, 0, 7], fov: 40 }}
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
                <div className="reveal-hint reveal-hint--flip">Glissez vers la gauche ou la droite pour retourner</div>
              )}
              {revealState.isFlipped && (
                <div className="reveal-hint reveal-hint--swipe">Glissez encore pour passer a la suivante</div>
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

        {/* ── RECAP: Summary of all cards (2D for fast loading) ── */}
        {phase === 'recap' && cards && (
          <div className="opened-cards-recap">
            <h3>Cartes obtenues !</h3>

            <div className="cards-reveal-grid">
              {sortedCards.map((card, index) => {
                const cardRarity = card.rarity || 'common';
                const borderColor = card.outline_color || RARITY_COLORS[cardRarity] || '#a0a0a0';
                return (
                  <div key={index} className="card-reveal-wrapper" style={{ animationDelay: `${index * 0.1}s` }}>
                    {card.isNew === false && <span className="card-badge card-badge--duplicate">DOUBLON</span>}
                    {card.isNew === true && <span className="card-badge card-badge--new">NEW</span>}
                    <div className="recap-card-2d" style={{ borderColor }}>
                      {card.image_url ? (
                        <img src={card.image_url} alt={card.name || 'Card'} className="recap-card-img" loading="eager" />
                      ) : (
                        <div className="recap-card-placeholder" style={{ background: card.background_color || '#1a1a2e' }}>
                          <span className="recap-card-emoji">&#127924;</span>
                        </div>
                      )}
                      <div className="recap-card-overlay">
                        <span className="recap-card-overlay-name">{card.name || 'Card'}</span>
                      </div>
                    </div>
                    <span className={`recap-card-name rarity-text--${cardRarity}`}>
                      {card.name || 'Card'}
                    </span>
                    <span className="recap-card-rarity">
                      {cardRarity.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                );
              })}
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
