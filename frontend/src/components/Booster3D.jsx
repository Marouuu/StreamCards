import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const PACK_W = 2.4;
const PACK_H = 3.6;
const PACK_D = 0.08; // very thin — real boosters are thin foil
const SEAL_H = 0.25;

// Load an image as a Three.js texture
function useImageTexture(imageUrl) {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    if (!imageUrl) { setTexture(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    };
    img.onerror = () => setTexture(null);
    img.src = imageUrl;
  }, [imageUrl]);
  return texture;
}

// Fallback gradient texture when no image provided
function useFallbackTexture(rarity, colorPrimary, colorAccent, name) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    const rarityGradients = {
      common: ['#8a8a8a', '#b0b0b0', '#d0d0d0'],
      uncommon: ['#1a6b1a', '#2ecc40', '#7ddf7d'],
      rare: ['#0a3d6b', '#0096ff', '#66c2ff'],
      epic: ['#3d0a6b', '#9600ff', '#c966ff'],
      legendary: ['#6b4a00', '#ffd700', '#ffec80'],
      'ultra-legendary': ['#ff0040', '#ff00ff', '#4000ff'],
    };
    const colors = (colorPrimary && colorAccent)
      ? [colorPrimary, colorAccent, colorAccent]
      : (rarityGradients[rarity] || rarityGradients.common);

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 60 + 20;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 6;
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 12);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const packName = name || 'Booster Pack';
    if (ctx.measureText(packName).width > canvas.width - 60) ctx.font = 'bold 26px Arial';
    ctx.fillText(packName, canvas.width / 2, canvas.height / 2);

    ctx.globalAlpha = 0.5;
    ctx.font = 'bold 18px Arial';
    ctx.fillText((rarity || 'common').toUpperCase().replace('-', ' '), canvas.width / 2, canvas.height / 2 + 45);
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.3;
    ctx.font = 'bold 14px Arial';
    ctx.fillText('STREAMCARDS', canvas.width / 2, canvas.height - 36);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [rarity, colorPrimary, colorAccent, name]);
}

// Seeded random for consistent organic noise
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Creates a realistic booster pack geometry:
// Mostly flat like real foil, with a gentle pillow bulge from cards inside,
// soft pinched seal areas at top/bottom, and subtle organic irregularities
function useBoosterGeometry() {
  return useMemo(() => {
    const segsX = 32;
    const segsY = 48;
    const rand = seededRandom(42);

    // Pre-generate noise for organic wrinkles
    const noiseGrid = [];
    for (let yi = 0; yi <= segsY; yi++) {
      noiseGrid[yi] = [];
      for (let xi = 0; xi <= segsX; xi++) {
        noiseGrid[yi][xi] = (rand() - 0.5) * 2;
      }
    }

    // Smooth the noise a bit
    const smoothed = [];
    for (let yi = 0; yi <= segsY; yi++) {
      smoothed[yi] = [];
      for (let xi = 0; xi <= segsX; xi++) {
        let sum = noiseGrid[yi][xi] * 2;
        let count = 2;
        if (yi > 0) { sum += noiseGrid[yi - 1][xi]; count++; }
        if (yi < segsY) { sum += noiseGrid[yi + 1][xi]; count++; }
        if (xi > 0) { sum += noiseGrid[yi][xi - 1]; count++; }
        if (xi < segsX) { sum += noiseGrid[yi][xi + 1]; count++; }
        smoothed[yi][xi] = sum / count;
      }
    }

    const positions = [];
    const uvs = [];
    const indices = [];

    // Build front face, then back face, then edge strips
    // Front face (z positive) — subdivided plane with pillow bulge
    const frontOffset = positions.length / 3;
    for (let yi = 0; yi <= segsY; yi++) {
      const yNorm = yi / segsY;
      const y = -PACK_H / 2 + yNorm * PACK_H;

      for (let xi = 0; xi <= segsX; xi++) {
        const xNorm = xi / segsX;
        const x = -PACK_W / 2 + xNorm * PACK_W;

        // Distance from center (0-1 range)
        const cx = (xNorm - 0.5) * 2; // -1 to 1
        const cy = (yNorm - 0.5) * 2; // -1 to 1

        // Seal zones
        const sealBottom = SEAL_H / PACK_H;
        const sealTop = 1 - SEAL_H / PACK_H;

        let z = PACK_D / 2;
        let width = PACK_W;

        if (yNorm < sealBottom) {
          // Bottom seal — pinch towards center, flatten
          const t = yNorm / sealBottom;
          const ease = t * t * (3 - 2 * t); // smoothstep
          z *= ease * 0.3 + 0.02;
          // Seal is slightly narrower
          const shrink = 1 - (1 - ease) * 0.05;
          const newX = x * shrink;
          positions.push(
            newX + smoothed[yi][xi] * 0.005 * ease,
            y,
            z + smoothed[yi][xi] * 0.003 * (1 - ease)
          );
        } else if (yNorm > sealTop) {
          // Top seal — same pinch
          const t = (1 - yNorm) / (1 - sealTop);
          const ease = t * t * (3 - 2 * t);
          z *= ease * 0.3 + 0.02;
          const shrink = 1 - (1 - ease) * 0.05;
          const newX = x * shrink;
          positions.push(
            newX + smoothed[yi][xi] * 0.005 * ease,
            y,
            z + smoothed[yi][xi] * 0.003 * (1 - ease)
          );
        } else {
          // Body — gentle pillow bulge, strongest in center
          const bodyYNorm = (yNorm - sealBottom) / (sealTop - sealBottom);
          // Pillow: bulge from center, fades at edges
          const edgeFalloffX = 1 - Math.pow(Math.abs(cx), 3);
          const edgeFalloffY = Math.sin(bodyYNorm * Math.PI);
          const pillow = edgeFalloffX * edgeFalloffY * 0.06;
          // Subtle wrinkles
          const wrinkle = smoothed[yi][xi] * 0.004 * edgeFalloffX;

          positions.push(
            x + smoothed[yi][xi] * 0.003,
            y + smoothed[yi][xi] * 0.001,
            z + pillow + wrinkle
          );
        }

        if (positions.length / 3 !== frontOffset + yi * (segsX + 1) + xi + 1) {
          // Already pushed in seal branch
        }

        // UV: image fills the entire front face
        uvs.push(xNorm, 1 - yNorm);
      }
    }

    // Fix: the seal branches already push, but body branch also pushes.
    // Actually let me rebuild this more cleanly.
    positions.length = 0;
    uvs.length = 0;

    // Helper to compute vertex position for front/back
    function computeVertex(xi, yi, side) {
      const xNorm = xi / segsX;
      const yNorm = yi / segsY;
      const x = -PACK_W / 2 + xNorm * PACK_W;
      const y = -PACK_H / 2 + yNorm * PACK_H;
      const sign = side === 'front' ? 1 : -1;

      const cx = (xNorm - 0.5) * 2;
      const sealBottom = SEAL_H / PACK_H;
      const sealTop = 1 - SEAL_H / PACK_H;

      let z, finalX;

      if (yNorm < sealBottom) {
        const t = yNorm / sealBottom;
        const ease = t * t * (3 - 2 * t);
        z = sign * (PACK_D / 2 * (ease * 0.3 + 0.02));
        const shrink = 1 - (1 - ease) * 0.05;
        finalX = x * shrink + smoothed[yi][xi] * 0.005 * ease;
        z += smoothed[yi][xi] * 0.003 * (1 - ease) * sign;
      } else if (yNorm > sealTop) {
        const t = (1 - yNorm) / (1 - sealTop);
        const ease = t * t * (3 - 2 * t);
        z = sign * (PACK_D / 2 * (ease * 0.3 + 0.02));
        const shrink = 1 - (1 - ease) * 0.05;
        finalX = x * shrink + smoothed[yi][xi] * 0.005 * ease;
        z += smoothed[yi][xi] * 0.003 * (1 - ease) * sign;
      } else {
        const bodyYNorm = (yNorm - sealBottom) / (sealTop - sealBottom);
        const edgeFalloffX = 1 - Math.pow(Math.abs(cx), 3);
        const edgeFalloffY = Math.sin(bodyYNorm * Math.PI);
        const pillow = edgeFalloffX * edgeFalloffY * 0.06;
        const wrinkle = smoothed[yi][xi] * 0.004 * edgeFalloffX;
        z = sign * (PACK_D / 2 + pillow + wrinkle);
        finalX = x + smoothed[yi][xi] * 0.003;
      }

      return {
        x: finalX,
        y: y + smoothed[yi][xi] * 0.001,
        z
      };
    }

    // Front face
    for (let yi = 0; yi <= segsY; yi++) {
      for (let xi = 0; xi <= segsX; xi++) {
        const v = computeVertex(xi, yi, 'front');
        positions.push(v.x, v.y, v.z);
        uvs.push(xi / segsX, 1 - yi / segsY);
      }
    }
    // Front face indices
    const vPerRow = segsX + 1;
    for (let yi = 0; yi < segsY; yi++) {
      for (let xi = 0; xi < segsX; xi++) {
        const a = yi * vPerRow + xi;
        const b = a + 1;
        const c = a + vPerRow;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    // Back face
    const backOffset = (segsY + 1) * vPerRow;
    for (let yi = 0; yi <= segsY; yi++) {
      for (let xi = 0; xi <= segsX; xi++) {
        const v = computeVertex(xi, yi, 'back');
        positions.push(v.x, v.y, v.z);
        // Mirror UV horizontally for back face (like wrapping paper)
        uvs.push(1 - xi / segsX, 1 - yi / segsY);
      }
    }
    // Back face indices (reversed winding)
    for (let yi = 0; yi < segsY; yi++) {
      for (let xi = 0; xi < segsX; xi++) {
        const a = backOffset + yi * vPerRow + xi;
        const b = a + 1;
        const c = a + vPerRow;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    // Edge strips connecting front and back along left/right edges
    const edgeOffset = backOffset + (segsY + 1) * vPerRow;
    // Left edge (xi = 0)
    for (let yi = 0; yi <= segsY; yi++) {
      const vf = computeVertex(0, yi, 'front');
      const vb = computeVertex(0, yi, 'back');
      positions.push(vf.x, vf.y, vf.z);
      uvs.push(0, 1 - yi / segsY);
      positions.push(vb.x, vb.y, vb.z);
      uvs.push(0, 1 - yi / segsY);
    }
    for (let yi = 0; yi < segsY; yi++) {
      const a = edgeOffset + yi * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    // Right edge (xi = segsX)
    const rightEdgeOffset = edgeOffset + (segsY + 1) * 2;
    for (let yi = 0; yi <= segsY; yi++) {
      const vf = computeVertex(segsX, yi, 'front');
      const vb = computeVertex(segsX, yi, 'back');
      positions.push(vf.x, vf.y, vf.z);
      uvs.push(1, 1 - yi / segsY);
      positions.push(vb.x, vb.y, vb.z);
      uvs.push(1, 1 - yi / segsY);
    }
    for (let yi = 0; yi < segsY; yi++) {
      const a = rightEdgeOffset + yi * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(b, c, a, d, c, b);
    }

    // Top edge strip (yi = 0) connecting front to back
    const topEdgeOffset = rightEdgeOffset + (segsY + 1) * 2;
    for (let xi = 0; xi <= segsX; xi++) {
      const vf = computeVertex(xi, 0, 'front');
      const vb = computeVertex(xi, 0, 'back');
      positions.push(vf.x, vf.y, vf.z);
      uvs.push(xi / segsX, 1);
      positions.push(vb.x, vb.y, vb.z);
      uvs.push(xi / segsX, 1);
    }
    for (let xi = 0; xi < segsX; xi++) {
      const a = topEdgeOffset + xi * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(b, c, a, d, c, b);
    }

    // Bottom edge strip (yi = segsY)
    const bottomEdgeOffset = topEdgeOffset + (segsX + 1) * 2;
    for (let xi = 0; xi <= segsX; xi++) {
      const vf = computeVertex(xi, segsY, 'front');
      const vb = computeVertex(xi, segsY, 'back');
      positions.push(vf.x, vf.y, vf.z);
      uvs.push(xi / segsX, 0);
      positions.push(vb.x, vb.y, vb.z);
      uvs.push(xi / segsX, 0);
    }
    for (let xi = 0; xi < segsX; xi++) {
      const a = bottomEdgeOffset + xi * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function BoosterPack({ isOpening, rarity, name, subtitle, imageUrl, colorPrimary, colorAccent, colorText, colorBackground, onOpenComplete }) {
  const groupRef = useRef();
  const topRef = useRef();
  const [openProgress, setOpenProgress] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [particleBurst, setParticleBurst] = useState(false);

  const rarityColors = {
    common: '#c8c8c8', uncommon: '#2ecc40', rare: '#0096ff',
    epic: '#9600ff', legendary: '#ffd700', 'ultra-legendary': '#ff00ff',
  };
  const glowColor = colorAccent || rarityColors[rarity] || rarityColors.common;

  const imageTex = useImageTexture(imageUrl);
  const fallbackTex = useFallbackTexture(rarity, colorPrimary, colorAccent, name);
  const activeTex = imageTex || fallbackTex;

  const boosterGeo = useBoosterGeometry();

  // Foil wrapper material — slight sheen like real packaging
  const wrapperMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: activeTex,
    metalness: 0.35,
    roughness: 0.35,
    side: THREE.FrontSide,
  }), [activeTex]);

  // Edge material — foil color derived from pack theme
  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: colorPrimary || (rarity === 'legendary' ? '#c8a800' : rarity === 'epic' ? '#6a00b0' : '#888888'),
    metalness: 0.5,
    roughness: 0.3,
  }), [colorPrimary, rarity]);

  const bodyH = PACK_H - SEAL_H * 2;
  const tearLineY = bodyH / 2 + SEAL_H;

  // Opening animation
  useEffect(() => {
    if (!isOpening) return;
    let startTime = null;
    let animFrame;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      if (elapsed < 800) {
        setShakeIntensity((elapsed / 800) * 0.8);
        setOpenProgress(0);
      } else if (elapsed < 2000) {
        const t = (elapsed - 800) / 1200;
        const eased = 1 - Math.pow(1 - t, 3);
        setShakeIntensity(Math.max(0, 0.8 - t * 2));
        setOpenProgress(eased);
        if (t > 0.3 && !particleBurst) setParticleBurst(true);
      } else {
        setOpenProgress(1);
        setShakeIntensity(0);
        if (onOpenComplete) onOpenComplete();
        return;
      }
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [isOpening]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (!isOpening) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    } else {
      if (shakeIntensity > 0) {
        groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 40) * 0.03 * shakeIntensity;
        groupRef.current.position.x = Math.sin(state.clock.elapsedTime * 50) * 0.02 * shakeIntensity;
      } else {
        groupRef.current.rotation.z = 0;
        groupRef.current.position.x = 0;
      }
    }
    if (topRef.current) {
      topRef.current.rotation.x = -openProgress * Math.PI * 0.75;
      topRef.current.position.z = openProgress * 0.3;
    }
  });

  const cardPositions = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({ y: -0.8 + i * 0.4, z: -0.005 * i, delay: i * 0.1 })),
  []);

  return (
    <group ref={groupRef}>
      {/* The foil wrapper — thin flat pouch with pillow bulge and organic wrinkles */}
      <mesh geometry={boosterGeo} material={wrapperMat} />

      {/* Tear line glow during opening */}
      {openProgress > 0 && openProgress < 1 && (
        <mesh position={[0, tearLineY, PACK_D / 2 + 0.01]}>
          <planeGeometry args={[PACK_W + 0.1, 0.015]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Cards emerging */}
      {openProgress > 0.3 && cardPositions.map((card, i) => {
        const cardProgress = Math.max(0, Math.min(1, (openProgress - 0.3 - card.delay) / 0.5));
        const cardY = card.y + cardProgress * (2.5 + i * 0.5);
        const cardZ = PACK_D / 2 + 0.01 + cardProgress * (1 + i * 0.3);
        return (
          <group key={i} position={[0, cardY, cardZ]} rotation={[cardProgress * Math.PI * 0.1, 0, 0]}>
            <mesh>
              <boxGeometry args={[1.6, 2.2, 0.02]} />
              <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <planeGeometry args={[1.5, 2.1]} />
              <meshStandardMaterial color={glowColor} metalness={0.3} roughness={0.5} transparent opacity={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* Ambient glow */}
      <pointLight position={[0, 0, 1.5]} intensity={isOpening ? 3 + openProgress * 5 : 0.5} color={glowColor} distance={8} />
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[PACK_W + 1, PACK_H + 1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={isOpening ? 0.1 + openProgress * 0.2 : 0.05} side={THREE.DoubleSide} />
      </mesh>

      {(rarity === 'legendary' || rarity === 'ultra-legendary') && (
        <Sparkles count={40} scale={[4, 5, 2]} size={2} speed={0.5} opacity={isOpening ? 1 : 0.5} color={glowColor} />
      )}
      {particleBurst && (
        <Sparkles count={80} scale={[5, 6, 4]} size={4} speed={2} opacity={1} color="#ffffff" />
      )}
    </group>
  );
}

function Booster3D({
  isOpening = false,
  rarity = 'common',
  name = 'Booster Pack',
  subtitle = null,
  imageUrl = null,
  colorPrimary = null,
  colorAccent = null,
  colorText = null,
  colorBackground = null,
  onOpenComplete,
}) {
  return (
    <BoosterPack
      isOpening={isOpening}
      rarity={rarity}
      name={name}
      subtitle={subtitle}
      imageUrl={imageUrl}
      colorPrimary={colorPrimary}
      colorAccent={colorAccent}
      colorText={colorText}
      colorBackground={colorBackground}
      onOpenComplete={onOpenComplete}
    />
  );
}

export default Booster3D;
