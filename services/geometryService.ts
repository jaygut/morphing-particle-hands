import * as THREE from 'three';
import { ShapeType } from '../types';

export const PARTICLE_COUNT = 15000;

const getRandomPointInSphere = (r: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const radius = Math.cbrt(Math.random()) * r;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * sinPhi * Math.sin(theta),
    radius * Math.cos(phi)
  );
};

export const generateShapePositions = (type: ShapeType, radius: number = 4): Float32Array => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const vec = new THREE.Vector3();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    switch (type) {
      case ShapeType.SPHERE: {
        const p = getRandomPointInSphere(radius);
        vec.copy(p);
        break;
      }
      case ShapeType.CUBE: {
        const size = radius * 1.5;
        vec.set(
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size
        );
        break;
      }
      case ShapeType.HEART: {
        // Parametric heart
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        // z = variation for 3D volume
        const t = Math.random() * Math.PI * 2;
        const r = Math.random(); // volume factor
        const scale = radius * 0.05; 
        
        // Base heart shape
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        
        // Add volume
        const z = (Math.random() - 0.5) * 4 * r;
        x *= r;
        y *= r;

        vec.set(x * scale, y * scale, z * scale);
        break;
      }
      case ShapeType.SPIRAL: {
        const t = Math.random() * 20; // Length of spiral
        const r = t * 0.2 + 0.5; // Radius grows with t
        const angle = t * 2;
        vec.set(
          r * Math.cos(angle),
          (t - 10) * 0.5, // Center vertically
          r * Math.sin(angle)
        );
        vec.multiplyScalar(radius * 0.25);
        // Add some noise
        vec.x += (Math.random() - 0.5) * 0.5;
        vec.z += (Math.random() - 0.5) * 0.5;
        break;
      }
      case ShapeType.SATURN: {
        // 70% Planet, 30% Rings
        if (i < PARTICLE_COUNT * 0.7) {
          const p = getRandomPointInSphere(radius * 0.6);
          vec.copy(p);
        } else {
          // Ring
          const angle = Math.random() * Math.PI * 2;
          const dist = (radius * 0.8) + Math.random() * (radius * 0.6);
          vec.set(
            Math.cos(angle) * dist,
            (Math.random() - 0.5) * 0.2, // Flat
            Math.sin(angle) * dist
          );
          // Tilt the ring
          vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.1);
          vec.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 0.1);
        }
        break;
      }
      case ShapeType.CLOUD: 
      default: {
        // Perlin-ish noise cloud (simplified random walks)
        const r = radius * (0.5 + Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        vec.setFromSphericalCoords(r, phi, theta);
        vec.multiplyScalar(Math.random());
        break;
      }
    }

    positions[i3] = vec.x;
    positions[i3 + 1] = vec.y;
    positions[i3 + 2] = vec.z;
  }

  return positions;
};