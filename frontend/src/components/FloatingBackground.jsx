import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { api } from '../config/api';
import './FloatingBackground.css';

/* ── Rarity colors ── */
const RARITY_COLORS = {
  common: '#a0a0a0', uncommon: '#2ecc40', rare: '#0096ff',
  epic: '#9600ff', legendary: '#ffd700', 'ultra-legendary': '#ff00ff',
};

/* ── Draw a card design onto a canvas (reused from Card3D) ── */
function drawCard(ctx, W, H, card, img) {
  const rarity = card?.rarity || 'common';
  const outlineColor = card?.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const bgColor = card?.background_color || '#1a1a2e';
  const textColor = card?.text_color || '#ffffff';
  const name = card?.name || 'Card';

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(5, 5, W - 10, H - 10, 16);
  ctx.stroke();

  // Inner border
  ctx.strokeStyle = outlineColor + '40';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 12);
  ctx.stroke();

  // Image area
  const imgX = 24, imgY = 24;
  const imgW = W - 48, imgH = H * 0.6;

  if (img) {
    const imgAspect = img.width / img.height;
    const areaAspect = imgW / imgH;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > areaAspect) { sw = img.height * areaAspect; sx = (img.width - sw) / 2; }
    else { sh = img.width / areaAspect; sy = (img.height - sh) / 2; }
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

  // Image border
  ctx.strokeStyle = outlineColor + '60';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgW, imgH, 8);
  ctx.stroke();

  // Name
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

  // Rarity badge
  const badgeY = H - 50;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(20, badgeY, W - 40, 34);
  ctx.fillStyle = outlineColor;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rarity.toUpperCase().replace('-', ' '), W / 2, badgeY + 17);
}

/* ── Draw card back ── */
function drawCardBack(ctx, W, H, rarity) {
  const color = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, W, H);

  // Radial glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  glow.addColorStop(0, color + '30');
  glow.addColorStop(0.5, color + '10');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Diamond pattern
  ctx.globalAlpha = 0.06;
  const ps = 40;
  for (let py = 0; py < H; py += ps) {
    for (let px = 0; px < W; px += ps) {
      ctx.save();
      ctx.translate(px + ps / 2, py + ps / 2);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(-ps / 4, -ps / 4, ps / 2, ps / 2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, H - 24, 20);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // SC logo
  ctx.fillStyle = color + '60';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SC', W / 2, H / 2);
}

/* ── Single floating card mesh ── */
function FloatingCard3D({ card, position, rotSpeed, floatSpeed, scale }) {
  const groupRef = useRef();
  const frontCanvasRef = useRef(null);
  const backCanvasRef = useRef(null);
  const frontTexRef = useRef(null);
  const backTexRef = useRef(null);

  // Create textures synchronously
  if (!frontCanvasRef.current) {
    const fc = document.createElement('canvas');
    fc.width = 256; fc.height = 358;
    frontCanvasRef.current = fc;
    const ft = new THREE.CanvasTexture(fc);
    ft.colorSpace = THREE.SRGBColorSpace;
    frontTexRef.current = ft;

    const bc = document.createElement('canvas');
    bc.width = 256; bc.height = 358;
    backCanvasRef.current = bc;
    const bt = new THREE.CanvasTexture(bc);
    bt.colorSpace = THREE.SRGBColorSpace;
    backTexRef.current = bt;
  }

  // Draw card (without image first)
  useMemo(() => {
    const ctx = frontCanvasRef.current.getContext('2d');
    drawCard(ctx, 256, 358, card, null);
    frontTexRef.current.needsUpdate = true;

    const bctx = backCanvasRef.current.getContext('2d');
    drawCardBack(bctx, 256, 358, card?.rarity);
    backTexRef.current.needsUpdate = true;
  }, [card]);

  // Load image async, then redraw with it
  useEffect(() => {
    const url = card?.image_url;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = frontCanvasRef.current.getContext('2d');
      drawCard(ctx, 256, 358, card, img);
      frontTexRef.current.needsUpdate = true;
    };
    img.src = url;
  }, [card?.image_url]);

  // Smooth 3D floating animation
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Slow continuous rotation
    groupRef.current.rotation.y += rotSpeed;
    groupRef.current.rotation.x = Math.sin(t * floatSpeed * 0.3) * 0.15;
    groupRef.current.rotation.z = Math.cos(t * floatSpeed * 0.2) * 0.08;

    // Float in space
    groupRef.current.position.y = position[1] + Math.sin(t * floatSpeed) * 0.6;
    groupRef.current.position.x = position[0] + Math.cos(t * floatSpeed * 0.6) * 0.4;
    groupRef.current.position.z = position[2] + Math.sin(t * floatSpeed * 0.4) * 0.3;
  });

  const CW = 1.2, CH = 1.68, CD = 0.03;

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Front face */}
      <mesh position={[0, 0, CD / 2 + 0.001]}>
        <planeGeometry args={[CW, CH]} />
        <meshStandardMaterial
          map={frontTexRef.current}
          transparent
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Back face */}
      <mesh position={[0, 0, -(CD / 2 + 0.001)]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CW, CH]} />
        <meshStandardMaterial
          map={backTexRef.current}
          transparent
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Card edge */}
      <mesh>
        <boxGeometry args={[CW, CH, CD]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
    </group>
  );
}

/* ── Scene with all floating cards ── */
function FloatingScene({ cards }) {
  const items = useMemo(() => {
    const count = 40;
    return Array.from({ length: count }, (_, i) => ({
      card: cards[i % cards.length],
      position: [
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 24,
        -2 - Math.random() * 12,
      ],
      rotSpeed: (Math.random() - 0.5) * 0.005,
      floatSpeed: 0.12 + Math.random() * 0.35,
      scale: 0.5 + Math.random() * 0.6,
    }));
  }, [cards]);

  return (
    <>
      {items.map((item, i) => (
        <FloatingCard3D key={`fc-${item.card.id}-${i}`} {...item} />
      ))}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={0.6} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} color="#9146ff" />
      <pointLight position={[10, 10, -10]} intensity={0.4} color="#667eea" />
    </>
  );
}

/* ── Placeholder cards when DB is empty ── */
const PLACEHOLDER_CARDS = Array.from({ length: 12 }, (_, i) => ({
  id: `ph-${i}`,
  name: ['Dragon', 'Phoenix', 'Shadow', 'Aurora', 'Titan', 'Frost',
         'Blaze', 'Storm', 'Mystic', 'Nova', 'Void', 'Prism'][i],
  rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra-legendary'][i % 6],
  effect: 'none',
  background_color: '#1a1a2e',
  text_color: '#ffffff',
}));

/* ── Main component ── */
export default function FloatingBackground() {
  const [cards, setCards] = useState(PLACEHOLDER_CARDS);

  useEffect(() => {
    let mounted = true;
    api.getRandomCards(25).then(data => {
      if (mounted && data.length > 0) setCards(data);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="floating-background">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <FloatingScene cards={cards} />
      </Canvas>
    </div>
  );
}
