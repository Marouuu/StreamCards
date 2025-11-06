import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, DoubleSide } from 'three';

function FloatingCard({ position, rotationSpeed, floatSpeed, scale, color }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      // Rotate the card
      meshRef.current.rotation.y += rotationSpeed;
      meshRef.current.rotation.x += rotationSpeed * 0.5;
      meshRef.current.rotation.z += rotationSpeed * 0.3;
      
      // Float up and down
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * floatSpeed) * 0.5;
      
      // Slight horizontal drift
      meshRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * floatSpeed * 0.7) * 0.3;
      
      // Slight depth movement
      meshRef.current.position.z = position[2] + Math.sin(state.clock.elapsedTime * floatSpeed * 0.5) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      {/* Card shape - a thin box */}
      <boxGeometry args={[1.2, 1.6, 0.05]} />
      <meshStandardMaterial 
        color={color}
        side={DoubleSide}
        metalness={0.2}
        roughness={0.6}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

export default function FloatingCards() {
  // Beautiful gradient color combinations
  const gradientColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12',
    '#E67E22', '#16A085', '#27AE60', '#2980B9', '#8E44AD',
    '#C0392B', '#D35400', '#E91E63', '#00BCD4', '#4CAF50',
    '#FF9800', '#2196F3', '#9C27B0', '#00ACC1', '#8BC34A',
    '#FF5722', '#3F51B5', '#673AB7', '#009688', '#FFC107',
  ];

  // Generate random cards with different positions, speeds, and colors
  const cards = useMemo(() => {
    const cardData = [];

    for (let i = 0; i < 30; i++) {
      // Pick a random color from the gradient palette
      const color = gradientColors[Math.floor(Math.random() * gradientColors.length)];
      
      cardData.push({
        position: [
          (Math.random() - 0.5) * 30, // x: -15 to 15
          (Math.random() - 0.5) * 20, // y: -10 to 10
          (Math.random() - 0.5) * 10 - 3, // z: -8 to -3
        ],
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        floatSpeed: 0.2 + Math.random() * 0.6,
        color: color,
        scale: 0.8 + Math.random() * 0.4, // Vary card sizes (0.8 to 1.2)
      });
    }
    return cardData;
  }, []);

  return (
    <>
      {cards.map((card, index) => (
        <FloatingCard
          key={index}
          position={card.position}
          rotationSpeed={card.rotationSpeed}
          floatSpeed={card.floatSpeed}
          color={card.color}
          scale={card.scale}
        />
      ))}
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={1.0} />
      {/* Directional light for depth */}
      <directionalLight position={[10, 10, 5]} intensity={1.0} />
      {/* Point lights for more dynamic lighting */}
      <pointLight position={[-10, -10, -10]} intensity={0.6} color="#9146ff" />
      <pointLight position={[10, 10, -10]} intensity={0.6} color="#667eea" />
    </>
  );
}

