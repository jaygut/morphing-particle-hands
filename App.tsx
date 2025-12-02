import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GUI from 'lil-gui'; 
import ParticleSystem from './components/ParticleSystem';
import HandController from './components/HandController';
import { ShapeType, HandData } from './types';

const App: React.FC = () => {
  const [targetShape, setTargetShape] = useState<ShapeType>(ShapeType.SPHERE);
  const [color, setColor] = useState('#00ffff');
  
  // Using a Ref for high-frequency hand updates to avoid re-rendering React tree
  const handDataRef = useRef<HandData>({
    isTracking: false,
    distance: 0.5,
    isFist: false,
    center: { x: 0.5, y: 0.5 },
    rotation: { x: 0, y: 0 }
  });

  // Setup Lil-GUI
  useEffect(() => {
    const gui = new GUI({ title: 'Controls' });
    
    const params = {
      shape: ShapeType.SPHERE,
      color: color,
    };

    gui.add(params, 'shape', Object.values(ShapeType)).onChange((val: ShapeType) => {
      setTargetShape(val);
    });

    gui.addColor(params, 'color').onChange((val: string) => {
      setColor(val);
    });

    // Style the GUI slightly to float nicely
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '20px';
    gui.domElement.style.left = '20px';

    return () => {
      gui.destroy();
    };
  }, []);

  const handleHandUpdate = (data: HandData) => {
    handDataRef.current = data;
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* 3D Scene */}
      <Canvas 
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 2]} // Handle high DPI screens
        gl={{ antialias: false }} // Performance optimization for particles
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <ParticleSystem 
          targetShape={targetShape} 
          baseColor={color} 
          handData={handDataRef}
        />
        <OrbitControls enableZoom={true} enablePan={false} autoRotate={false} />
      </Canvas>

      {/* Instructions Overlay */}
      <div className="absolute top-6 right-6 text-right pointer-events-none select-none text-white/80 max-w-sm">
        <h1 className="text-2xl font-bold tracking-wider mb-2">PARTICLE MORPH</h1>
        <div className="text-sm space-y-1 opacity-70">
          <p>Spread hands wide to <span className="text-cyan-400 font-bold">SUPERNOVA</span>.</p>
          <p>Move hands L/R/U/D to <span className="text-yellow-400 font-bold">ROTATE</span>.</p>
          <p>Make a fist to trigger <span className="text-red-400 font-bold">GRAVITY</span>.</p>
          <p>Switch shapes using the panel.</p>
        </div>
      </div>

      {/* Vision Logic & Thumbnail */}
      <HandController onUpdate={handleHandUpdate} />
    </div>
  );
};

export default App;