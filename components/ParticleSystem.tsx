import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShapeType, HandData } from '../types';
import { PARTICLE_COUNT, generateShapePositions } from '../services/geometryService';

interface ParticleSystemProps {
  targetShape: ShapeType;
  baseColor: string;
  handData: React.MutableRefObject<HandData>;
}

// Generate a soft glow texture
const getTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = true;
  return texture;
};

const ParticleSystem: React.FC<ParticleSystemProps> = ({ targetShape, baseColor, handData }) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  // Store the "true" target positions for the current shape
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  // Store the current simulated positions
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  // Velocities for physics effects
  const velocitiesRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  
  const texture = useMemo(() => getTexture(), []);

  // Update target positions when shape selection changes
  useEffect(() => {
    const newPositions = generateShapePositions(targetShape);
    targetPositionsRef.current.set(newPositions);
    
    // If first load, snap current to target
    if (currentPositionsRef.current.every(v => v === 0)) {
       currentPositionsRef.current.set(newPositions);
    }
  }, [targetShape]);

  // Update Color
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.set(baseColor);
    }
  }, [baseColor]);

  // Animation Loop
  useFrame((state) => {
    if (!geometryRef.current || !pointsRef.current || !materialRef.current) return;

    const { distance, isFist, isTracking, rotation } = handData.current;
    
    // Rotation Control
    // Lerp towards hand rotation if tracking, otherwise slow spin
    if (isTracking) {
      pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, rotation.x, 0.1);
      pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, rotation.y, 0.1);
    } else {
      pointsRef.current.rotation.y += 0.001;
      pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, 0, 0.05);
    }

    // Supernova Burst Logic
    // If distance is very high (user stretching hands max), trigger burst
    const isBurst = distance > 0.85;

    // Visual Flair for Burst
    if (isBurst) {
       materialRef.current.color.setHex(0xFFFFFF); // Flash white
       materialRef.current.opacity = 0.9;
       materialRef.current.size = 0.2;
    } else {
       // Return to base color lerped (simple visual return logic)
       materialRef.current.color.lerp(new THREE.Color(baseColor), 0.1);
       materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, 0.8, 0.1);
       materialRef.current.size = THREE.MathUtils.lerp(materialRef.current.size, 0.15, 0.1);
    }

    // Interactive parameters
    const time = state.clock.getElapsedTime();
    const breathing = Math.sin(time * 0.5) * 0.1 + 1;
    // If burst, expansion is ignored, particles fly free
    const expansionFactor = isTracking && !isBurst ? 0.5 + (distance * 1.5) : breathing;
    
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const targets = targetPositionsRef.current;
    const current = currentPositionsRef.current;
    const velocities = velocitiesRef.current;

    // Physics constants
    const lerpSpeed = 0.05; 
    let returnForce = 0.03; // Strength of attraction to shape
    const gravityStrength = 0.2; 
    const damping = 0.90; 

    // Adjust physics for Burst
    if (isBurst) {
      returnForce = 0; // Disable returning to shape
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // 1. Calculate Target Point
      const tx = targets[i3] * expansionFactor;
      const ty = targets[i3 + 1] * expansionFactor;
      const tz = targets[i3 + 2] * expansionFactor;

      // 2. Physics Integration
      
      // Force: Return to shape
      let ax = (tx - current[i3]) * returnForce;
      let ay = (ty - current[i3 + 1]) * returnForce;
      let az = (tz - current[i3 + 2]) * returnForce;

      // Force: Fist Gravity (Suck to center)
      if (isFist) {
        ax -= current[i3] * 0.05; 
        ay -= current[i3+1] * 0.05;
        az -= current[i3+2] * 0.05;
        // Add jitter
        ax += (Math.random() - 0.5) * 0.1;
        ay += (Math.random() - 0.5) * 0.1;
        az += (Math.random() - 0.5) * 0.1;
      }

      // Force: Supernova Burst (Explode outward)
      if (isBurst) {
        // Vector from center
        const dx = current[i3];
        const dy = current[i3+1];
        const dz = current[i3+2];
        
        // Add strong radial force
        const force = 0.02 + Math.random() * 0.01;
        ax += dx * force;
        ay += dy * force;
        az += dz * force;
      }

      // Update Velocity
      velocities[i3] += ax;
      velocities[i3 + 1] += ay;
      velocities[i3 + 2] += az;

      // Apply Damping
      velocities[i3] *= damping;
      velocities[i3 + 1] *= damping;
      velocities[i3 + 2] *= damping;

      // Update Current Position
      current[i3] += velocities[i3];
      current[i3 + 1] += velocities[i3 + 1];
      current[i3 + 2] += velocities[i3 + 2];

      // Update Geometry Attribute
      positions[i3] = current[i3];
      positions[i3 + 1] = current[i3 + 1];
      positions[i3 + 2] = current[i3 + 2];
    }

    geometryRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={new Float32Array(PARTICLE_COUNT * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.15}
        map={texture}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexColors={false}
      />
    </points>
  );
};

export default ParticleSystem;