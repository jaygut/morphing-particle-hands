import React from 'react';

export enum ShapeType {
  SPHERE = 'Sphere',
  CUBE = 'Cube',
  HEART = 'Heart',
  SPIRAL = 'Spiral',
  SATURN = 'Saturn',
  CLOUD = 'Cloud'
}

export interface HandData {
  isTracking: boolean;
  distance: number; // Normalized 0-1 (approx) between index fingers
  isFist: boolean; // True if gestures suggest a fist/grab
  center: { x: number; y: number }; // Screen space center of interaction
  rotation: { x: number; y: number }; // Rotation based on hand position
}

// Fix for React Three Fiber JSX elements not being recognized
declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      ambientLight: any;
      color: any;
    }
  }
}