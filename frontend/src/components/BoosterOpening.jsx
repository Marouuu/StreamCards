import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import Booster3D from './Booster3D';
import './BoosterOpening.css';

function BoosterOpening({ booster, onClose, cards }) {
  const [isOpening, setIsOpening] = useState(false);
  const [showCards, setShowCards] = useState(false);

  const handleOpen = () => {
    setIsOpening(true);
    // Afficher les cartes après l'animation
    setTimeout(() => {
      setShowCards(true);
    }, 2000);
  };

  const handleOpenComplete = () => {
    console.log('Booster ouvert !');
  };

  return (
    <div className="booster-opening-overlay">
      <div className="booster-opening-container">
        <button className="close-opening-btn" onClick={onClose}>
          ✕
        </button>
        
        <div className="booster-canvas-container">
          <Canvas
            camera={{ position: [0, 0, 8], fov: 50 }}
            gl={{ alpha: true, antialias: true }}
          >
            <PerspectiveCamera makeDefault position={[0, 0, 8]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            
            <Suspense fallback={null}>
              <Booster3D
                isOpening={isOpening}
                rarity={booster?.rarity || 'common'}
                onOpenComplete={handleOpenComplete}
              />
            </Suspense>
            
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              enableRotate={!isOpening}
              autoRotate={!isOpening}
              autoRotateSpeed={0.5}
            />
          </Canvas>
        </div>

        {!isOpening && (
          <button className="open-booster-btn" onClick={handleOpen}>
            Ouvrir le booster
          </button>
        )}

        {showCards && cards && (
          <div className="opened-cards">
            <h3>Cartes obtenues :</h3>
            <div className="cards-reveal">
              {cards.map((cardId, index) => (
                <div key={index} className="card-reveal-item">
                  Carte #{cardId}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoosterOpening;

