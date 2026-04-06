import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CARD_W = 2.5;
const CARD_H = 3.5;
const CARD_D = 0.03;
const CORNER_R = 0.12;

const RARITY_COLORS = {
  common: '#a0a0a0',
  uncommon: '#2ecc40',
  rare: '#0096ff',
  epic: '#9600ff',
  legendary: '#ffd700',
  'ultra-legendary': '#ff00ff',
};

// Load image as Three.js texture
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

// Generate card back texture (stylized design)
function useCardBackTexture(rarity, creatorName) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d');
    const color = RARITY_COLORS[rarity] || RARITY_COLORS.common;

    // Dark base
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radial glow from center
    const glow = ctx.createRadialGradient(256, 358, 0, 256, 358, 350);
    glow.addColorStop(0, color + '30');
    glow.addColorStop(0.5, color + '10');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diamond pattern
    ctx.globalAlpha = 0.06;
    const patternSize = 40;
    for (let py = 0; py < canvas.height; py += patternSize) {
      for (let px = 0; px < canvas.width; px += patternSize) {
        ctx.save();
        ctx.translate(px + patternSize / 2, py + patternSize / 2);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(-patternSize / 4, -patternSize / 4, patternSize / 2, patternSize / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.5;
    const br = 20;
    ctx.beginPath();
    ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 24, br);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Inner decorative border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.roundRect(24, 24, canvas.width - 48, canvas.height - 48, br - 4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Center emblem — stylized "SC" logo
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 - 20);

    // Circle behind emblem
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fillStyle = color + '15';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // SC text
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SC', 0, 0);
    ctx.globalAlpha = 1;

    ctx.restore();

    // "STREAMCARDS" text at bottom
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STREAMCARDS', canvas.width / 2, canvas.height - 40);
    ctx.globalAlpha = 1;

    // Creator name if available
    if (creatorName) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      ctx.font = '13px Arial';
      ctx.fillText(creatorName, canvas.width / 2, canvas.height - 60);
      ctx.globalAlpha = 1;
    }

    // Rarity text at top
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.font = 'bold 12px Arial';
    ctx.fillText((rarity || 'common').toUpperCase().replace('-', ' '), canvas.width / 2, 36);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [rarity, creatorName]);
}

// Draws a full trading card face (border, image with cover-fit, name, rarity) onto a canvas
function useCardFrontTexture(imageUrl, card) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    const rarity = card?.rarity || 'common';
    const outlineColor = card?.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
    const bgColor = card?.background_color || '#1a1a2e';
    const textColor = card?.text_color || '#ffffff';
    const name = card?.name || 'Card';
    const description = card?.description || '';
    const creatorName = card?.creator_display_name || card?.creator_name || '';
    const url = imageUrl || card?.image_url;

    const W = 512, H = 716;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    function drawCard(img) {
      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Outer border
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(5, 5, W - 10, H - 10, 16);
      ctx.stroke();

      // Inner glow border
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

      // Image border
      ctx.strokeStyle = outlineColor + '60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, 8);
      ctx.stroke();

      // Card name
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

      // Description
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

      // Creator tag
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

      // Rarity badge
      const badgeY = H - 50;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(20, badgeY, W - 40, 34);
      ctx.fillStyle = outlineColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rarity.toUpperCase().replace('-', ' '), W / 2, badgeY + 17);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    }

    if (url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => drawCard(img);
      img.onerror = () => drawCard(null);
      img.src = url;
    } else {
      drawCard(null);
    }
  }, [imageUrl, card?.image_url, card?.name, card?.rarity, card?.outline_color, card?.background_color]);

  return texture;
}

function Card3D({
  card = {},
  imageUrl = null,
  backImageUrl = null,
  isFlipped = false,
  isRevealing = false,
  onClick,
  autoRotate = false,
  floatAnimation = true,
  scale = 1,
}) {
  const groupRef = useRef();
  const [flipProgress, setFlipProgress] = useState(isFlipped ? 1 : 0);
  const [revealBurst, setRevealBurst] = useState(false);

  const rarity = card.rarity || 'common';
  const glowColor = card.outline_color || RARITY_COLORS[rarity] || '#a0a0a0';
  const creatorName = card.creator_display_name || card.creator_name || null;
  const isHighRarity = ['epic', 'legendary', 'ultra-legendary'].includes(rarity);

  const frontTex = useCardFrontTexture(imageUrl || card.image_url, card);
  const backTex = backImageUrl ? useImageTexture(backImageUrl) : useCardBackTexture(rarity, creatorName);

  // Flip animation
  useEffect(() => {
    if (isRevealing) {
      setRevealBurst(true);
      const timer = setTimeout(() => setRevealBurst(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isRevealing]);

  useEffect(() => {
    let animFrame;
    const target = isFlipped ? 1 : 0;
    const animate = () => {
      setFlipProgress(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.01) return target;
        animFrame = requestAnimationFrame(animate);
        return prev + diff * 0.08;
      });
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [isFlipped]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.rotation.y = flipProgress * Math.PI;

    if (floatAnimation && !isRevealing) {
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.08;
      if (autoRotate) {
        groupRef.current.rotation.y += Math.sin(t * 0.5) * 0.1;
      }
    }

    if (isRevealing) {
      groupRef.current.rotation.y = t * 4;
      const revealScale = 1 + Math.sin(t * 3) * 0.05;
      groupRef.current.scale.setScalar(scale * revealScale);
    }
  });

  return (
    <group ref={groupRef} scale={scale} onClick={onClick}>
      {/* Front face — card image */}
      <mesh position={[0, 0, CARD_D / 2 + 0.002]} renderOrder={1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={frontTex} metalness={isHighRarity ? 0.4 : 0.1} roughness={isHighRarity ? 0.3 : 0.5} />
      </mesh>

      {/* Back face — card back design */}
      <mesh position={[0, 0, -(CARD_D / 2 + 0.002)]} rotation={[0, Math.PI, 0]} renderOrder={1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={backTex} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Thin edge */}
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <meshStandardMaterial color={glowColor} metalness={0.3} roughness={0.4} />
      </mesh>

      {isHighRarity && (
        <pointLight position={[0, 0, 0.3]}
          intensity={rarity === 'ultra-legendary' ? 2 : rarity === 'legendary' ? 1.5 : 0.8}
          color={glowColor} distance={4} />
      )}
      <pointLight position={[0, 0, -0.3]} intensity={0.3} color={glowColor} distance={3} />

      {revealBurst && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[CARD_W + 2, CARD_H + 2]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export default Card3D;
