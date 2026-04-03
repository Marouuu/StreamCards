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
    setTimeout(() => setShowCards(true), 2200);
  };

  return (
    <div className="booster-opening-overlay">
      <div className="booster-opening-container">
        <button className="close-opening-btn" onClick={onClose}>✕</button>
        <h2 className="opening-title">{booster?.name || 'Booster Pack'}</h2>

        <div className="booster-canvas-container">
          <Canvas
            camera={{ position: [0, 0, 7], fov: 45 }}
            gl={{ alpha: true, antialias: true, toneMapping: 3 }}
          >
            <PerspectiveCamera makeDefault position={[0, 0, 7]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} />
            <directionalLight position={[-5, -3, 5]} intensity={0.4} />
            <pointLight position={[0, 0, 4]} intensity={0.8} color="#ffffff" />

            <Suspense fallback={null}>
              <Booster3D
                isOpening={isOpening}
                rarity={booster?.rarity || 'common'}
                name={booster?.name || 'Booster Pack'}
                subtitle={booster?.subtitle || null}
                imageUrl={booster?.image_url || booster?.imageUrl || null}
                colorPrimary={booster?.color_primary || null}
                colorAccent={booster?.color_accent || null}
                colorText={booster?.color_text || null}
                colorBackground={booster?.color_background || null}
                onOpenComplete={() => console.log('Booster opened!')}
              />
            </Suspense>

            <OrbitControls
              enableZoom={false}
              enablePan={false}
              enableRotate={!isOpening}
              autoRotate={!isOpening}
              autoRotateSpeed={1.5}
              maxPolarAngle={Math.PI * 0.65}
              minPolarAngle={Math.PI * 0.35}
            />
          </Canvas>
        </div>

        {!isOpening && !showCards && (
          <button className="open-booster-btn" onClick={handleOpen}>Ouvrir le booster</button>
        )}

        {showCards && cards && (
          <div className="opened-cards">
            <h3>Cartes obtenues :</h3>
            <div className="cards-reveal">
              {cards.map((cardId, index) => (
                <div key={index} className="card-reveal-item">Carte #{cardId}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoosterOpening;
