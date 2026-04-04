import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Booster3D from './Booster3D';

function BoosterMini3D({ booster }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 40 }}
      gl={{ alpha: true, antialias: true, toneMapping: 3 }}
      style={{ pointerEvents: 'auto' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1} />
      <directionalLight position={[-3, -2, 3]} intensity={0.3} />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#ffffff" />

      <Suspense fallback={null}>
        <Booster3D
          isOpening={false}
          rarity={booster?.rarity || 'common'}
          name={booster?.name || 'Booster'}
          subtitle={booster?.subtitle || null}
          imageUrl={booster?.image_url || null}
          colorPrimary={booster?.color_primary || null}
          colorAccent={booster?.color_accent || null}
          colorText={booster?.color_text || null}
          colorBackground={booster?.color_background || null}
        />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={2}
        maxPolarAngle={Math.PI * 0.6}
        minPolarAngle={Math.PI * 0.4}
      />
    </Canvas>
  );
}

export default BoosterMini3D;
