import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// Creates a canvas texture for the booster front face
function useBoosterTexture(imageUrl, rarity, name, subtitle, colorPrimary, colorAccent, colorText) {
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

    // Use custom colors if provided, otherwise fall back to rarity
    let colors;
    if (colorPrimary && colorAccent) {
      colors = [colorPrimary, colorAccent, colorAccent];
    } else {
      colors = rarityGradients[rarity] || rarityGradients.common;
    }

    const txtColor = colorText || '#ffffff';

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Foil pattern overlay
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 60 + 20;
      const radGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radGrad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    // Border / frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 8;
    ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 16);
    ctx.stroke();

    // Inner frame for image area
    const imgAreaX = 40;
    const imgAreaY = 100;
    const imgAreaW = canvas.width - 80;
    const imgAreaH = 380;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.roundRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH, 12);
    ctx.fill();

    // Pack icon placeholder (if no image)
    if (!imageUrl) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = '120px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎴', canvas.width / 2, imgAreaY + imgAreaH / 2);
    }

    // Pack name
    ctx.fillStyle = txtColor;
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Word wrap if needed
    const maxWidth = canvas.width - 80;
    const nameText = name || 'Booster Pack';
    if (ctx.measureText(nameText).width > maxWidth) {
      ctx.font = 'bold 26px Arial, sans-serif';
    }
    ctx.fillText(nameText, canvas.width / 2, 540);

    // Subtitle
    if (subtitle) {
      ctx.fillStyle = txtColor;
      ctx.globalAlpha = 0.7;
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText(subtitle, canvas.width / 2, 580);
      ctx.globalAlpha = 1;
    }

    // Rarity label
    ctx.fillStyle = txtColor;
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      (rarity || 'common').toUpperCase().replace('-', ' '),
      canvas.width / 2,
      subtitle ? 620 : 600
    );
    ctx.globalAlpha = 1;

    // Top seal strip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, canvas.width, 60);

    // Dotted tear line
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 65);
    ctx.lineTo(canvas.width - 20, 65);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✂ TEAR HERE', canvas.width - 30, 58);

    // StreamCards branding
    ctx.fillStyle = txtColor;
    ctx.globalAlpha = 0.4;
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STREAMCARDS', canvas.width / 2, 730);
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [imageUrl, rarity, name, subtitle, colorPrimary, colorAccent, colorText]);
}

// Creates the back face texture
function useBackTexture(rarity, colorPrimary, colorBackground) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    const rarityColors = {
      common: '#a0a0a0',
      uncommon: '#2ecc40',
      rare: '#0096ff',
      epic: '#9600ff',
      legendary: '#ffd700',
      'ultra-legendary': '#ff00ff',
    };
    const patternColor = colorPrimary || rarityColors[rarity] || rarityColors.common;
    const bgColor = colorBackground || '#1a1a2e';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diamond pattern
    ctx.strokeStyle = patternColor;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1;
    const step = 40;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + step / 2, y);
        ctx.lineTo(x + step, y + step / 2);
        ctx.lineTo(x + step / 2, y + step);
        ctx.lineTo(x, y + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Center logo
    ctx.fillStyle = patternColor;
    ctx.globalAlpha = 0.3;
    ctx.font = 'bold 80px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SC', canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [rarity, colorPrimary, colorBackground]);
}

function BoosterPack({ isOpening, rarity, name, subtitle, imageUrl, colorPrimary, colorAccent, colorText, colorBackground, onOpenComplete }) {
  const groupRef = useRef();
  const topRef = useRef();
  const [openProgress, setOpenProgress] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [particleBurst, setParticleBurst] = useState(false);

  const frontTexture = useBoosterTexture(imageUrl, rarity, name, subtitle, colorPrimary, colorAccent, colorText);
  const backTexture = useBackTexture(rarity, colorPrimary, colorBackground);

  // Load custom image onto front texture if provided
  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = frontTexture.image;
        const ctx = canvas.getContext('2d');
        const imgAreaX = 46;
        const imgAreaY = 106;
        const imgAreaW = canvas.width - 92;
        const imgAreaH = 368;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH, 8);
        ctx.clip();
        const scale = Math.max(imgAreaW / img.width, imgAreaH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = imgAreaX + (imgAreaW - w) / 2;
        const y = imgAreaY + (imgAreaH - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
        frontTexture.needsUpdate = true;
      };
      img.src = imageUrl;
    }
  }, [imageUrl, frontTexture]);

  const packWidth = 2.4;
  const packHeight = 3.6;
  const packDepth = 0.25;
  const tearLineY = packHeight / 2 - 0.3;

  // Resolve glow color
  const rarityColors = {
    common: '#c8c8c8', uncommon: '#2ecc40', rare: '#0096ff',
    epic: '#9600ff', legendary: '#ffd700', 'ultra-legendary': '#ff00ff',
  };
  const glowColor = colorAccent || rarityColors[rarity] || rarityColors.common;

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

  // Idle + opening frame updates
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

  // Materials
  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor).multiplyScalar(0.6),
      metalness: 0.7, roughness: 0.3,
    });
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTexture, metalness: 0.3, roughness: 0.4 });
    const backMat = new THREE.MeshStandardMaterial({ map: backTexture, metalness: 0.3, roughness: 0.5 });
    return [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
  }, [frontTexture, backTexture, glowColor]);

  const topMaterials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor).multiplyScalar(0.5),
      metalness: 0.7, roughness: 0.3,
    });
    const foilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor), metalness: 0.8, roughness: 0.2,
      emissive: new THREE.Color(glowColor), emissiveIntensity: 0.1,
    });
    return [sideMat, sideMat, foilMat, foilMat, foilMat, foilMat];
  }, [glowColor]);

  // Cards inside
  const cardPositions = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({ y: -0.8 + i * 0.4, z: -0.005 * i, delay: i * 0.1 })),
  []);

  return (
    <group ref={groupRef}>
      {/* Pack body */}
      <mesh position={[0, -(packHeight * 0.08) / 2, 0]} material={materials}>
        <boxGeometry args={[packWidth, packHeight * 0.92, packDepth]} />
      </mesh>

      {/* Top tear flap */}
      <group ref={topRef} position={[0, packHeight / 2 - packHeight * 0.08 / 2, 0]}>
        <mesh material={topMaterials}>
          <boxGeometry args={[packWidth, packHeight * 0.08, packDepth + 0.01]} />
        </mesh>
      </group>

      {/* Tear line glow */}
      {openProgress > 0 && openProgress < 1 && (
        <mesh position={[0, tearLineY, packDepth / 2 + 0.01]}>
          <planeGeometry args={[packWidth + 0.1, 0.02]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Cards emerging */}
      {openProgress > 0.3 && cardPositions.map((card, i) => {
        const cardProgress = Math.max(0, Math.min(1, (openProgress - 0.3 - card.delay) / 0.5));
        const cardY = card.y + cardProgress * (2.5 + i * 0.5);
        const cardZ = packDepth / 2 + 0.01 + cardProgress * (1 + i * 0.3);
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

      {/* Glow */}
      <pointLight position={[0, 0, 1.5]} intensity={isOpening ? 3 + openProgress * 5 : 0.5} color={glowColor} distance={8} />
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[packWidth + 1, packHeight + 1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={isOpening ? 0.1 + openProgress * 0.2 : 0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Sparkles for legendary+ */}
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
