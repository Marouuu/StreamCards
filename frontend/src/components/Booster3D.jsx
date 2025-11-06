import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Sparkles } from '@react-three/drei';
import { MeshStandardMaterial } from 'three';

function Booster3D({ isOpening = false, rarity = 'common', onOpenComplete }) {
  const boosterRef = useRef();
  const lidRef = useRef();
  const [lidRotation, setLidRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Rarity colors
  const rarityColors = {
    common: { main: '#c8c8c8', accent: '#a0a0a0' },
    uncommon: { main: '#00ff00', accent: '#00cc00' },
    rare: { main: '#0096ff', accent: '#0066cc' },
    epic: { main: '#9600ff', accent: '#6600cc' },
    legendary: { main: '#ffd700', accent: '#ffaa00' },
    'ultra-legendary': { main: '#ff0000', accent: '#9400d3' }
  };

  const colors = rarityColors[rarity] || rarityColors.common;

  useEffect(() => {
    if (isOpening && !isAnimating) {
      setIsAnimating(true);
      // Animation d'ouverture
      const duration = 2000; // 2 secondes
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function pour une animation fluide
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        
        // Rotation du couvercle (0 à -Math.PI/2 pour ouvrir vers l'avant)
        const rotation = -Math.PI / 2 * easeOutCubic;
        setLidRotation(rotation);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          if (onOpenComplete) {
            onOpenComplete();
          }
        }
      };
      
      animate();
    }
  }, [isOpening, isAnimating, onOpenComplete]);

  // Rotation légère du booster et animation du couvercle
  useFrame((state) => {
    if (boosterRef.current && !isOpening) {
      boosterRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      boosterRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
    }
    
    // Animation du couvercle pendant l'ouverture
    if (lidRef.current && isOpening) {
      // Légère vibration pendant l'ouverture
      const vibration = Math.sin(state.clock.elapsedTime * 20) * 0.02;
      lidRef.current.position.x = vibration;
    }
  });

  return (
    <group ref={boosterRef} position={[0, 0, 0]}>
      {/* Corps du booster */}
      <Box
        args={[2, 2.5, 1.5]}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial
          color={colors.main}
          metalness={0.4}
          roughness={0.5}
          emissive={colors.main}
          emissiveIntensity={isOpening ? 0.4 : 0.2}
        />
      </Box>

      {/* Intérieur du booster (visible quand ouvert) */}
      {isOpening && (
        <Box
          args={[1.9, 2.3, 1.4]}
          position={[0, -0.1, 0]}
        >
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.1}
            roughness={0.9}
            emissive="#000000"
            emissiveIntensity={0}
          />
        </Box>
      )}

      {/* Couvercle du booster */}
      <group ref={lidRef} rotation={[lidRotation, 0, 0]} position={[0, 1.25, 0]}>
        <Box
          args={[2.1, 0.3, 1.6]}
          position={[0, 0, 0]}
        >
          <meshStandardMaterial
            color={colors.accent}
            metalness={0.6}
            roughness={0.3}
            emissive={colors.accent}
            emissiveIntensity={isOpening ? 0.5 : 0.3}
          />
        </Box>
      </group>

      {/* Bande décorative supérieure */}
      <Box
        args={[2.2, 0.2, 1.7]}
        position={[0, 1.1, 0]}
      >
        <meshStandardMaterial
          color={colors.accent}
          metalness={0.7}
          roughness={0.2}
          emissive={colors.accent}
          emissiveIntensity={0.4}
        />
      </Box>

      {/* Bande décorative inférieure */}
      <Box
        args={[2.2, 0.2, 1.7]}
        position={[0, -0.8, 0]}
      >
        <meshStandardMaterial
          color={colors.accent}
          metalness={0.6}
          roughness={0.2}
          emissive={colors.accent}
          emissiveIntensity={0.4}
        />
      </Box>

      {/* Effet de lumière pour les raretés élevées */}
      {(rarity === 'legendary' || rarity === 'ultra-legendary') && (
        <>
          <pointLight
            position={[0, 0, 0]}
            intensity={isOpening ? 2 : 1}
            color={colors.main}
            distance={5}
          />
          <Sparkles
            count={50}
            scale={[4, 4, 4]}
            size={2}
            speed={0.4}
            opacity={isOpening ? 1 : 0.6}
            color={colors.main}
          />
        </>
      )}

      {/* Particules lors de l'ouverture */}
      {isOpening && (
        <Sparkles
          count={30}
          scale={[3, 3, 3]}
          size={3}
          speed={1}
          opacity={1}
          color={colors.accent}
        />
      )}
    </group>
  );
}

export default Booster3D;

