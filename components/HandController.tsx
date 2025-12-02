import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandData } from '../types';

interface HandControllerProps {
  onUpdate: (data: HandData) => void;
}

const HandController: React.FC<HandControllerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  // Fix: Initialize useRef with 0 to satisfy the "Expected 1 arguments" error
  const requestRef = useRef<number>(0);

  // Initialize MediaPipe
  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        
        setLoading(false);
      } catch (err) {
        console.error("Failed to init MediaPipe:", err);
      }
    };
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Setup Camera
  useEffect(() => {
    if (loading || !handLandmarkerRef.current || !videoRef.current) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predict);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    startCamera();
  }, [loading]);

  const predict = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = handLandmarkerRef.current;
    
    if (!video || !canvas || !landmarker) return;

    let lastVideoTime = -1;
    const ctx = canvas.getContext('2d');

    const renderLoop = () => {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        const results = landmarker.detectForVideo(video, performance.now());
        
        // Draw to canvas for feedback
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Mirror the video
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          if (results.landmarks) {
             const drawingUtils = new DrawingUtils(ctx);
             for (const landmarks of results.landmarks) {
               drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
               drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1, radius: 2 });
             }
          }
          ctx.restore();
        }

        // --- Logic Calculation ---
        let distance = 0.5; // Default neutral
        let isFist = false;
        let isTracking = false;
        const center = { x: 0.5, y: 0.5 };
        const rotation = { x: 0, y: 0 };

        if (results.landmarks && results.landmarks.length > 0) {
          isTracking = true;

          // 1. Calculate Centroid (for rotation)
          let sumX = 0;
          let sumY = 0;
          let pointCount = 0;
          
          // Use wrist (0) and index (8) for a stable center approximation
          results.landmarks.forEach(hand => {
             sumX += hand[0].x + hand[8].x;
             sumY += hand[0].y + hand[8].y;
             pointCount += 2;
          });

          if (pointCount > 0) {
            // Raw MediaPipe coordinates are 0-1.
            // x: 0 (left) -> 1 (right)
            // y: 0 (top) -> 1 (bottom)
            const rawX = sumX / pointCount;
            const rawY = sumY / pointCount;
            
            // Mirror X because we look at a mirrored canvas
            center.x = 1 - rawX; 
            center.y = rawY;

            // Map center to rotation angles
            // X movement -> Y rotation (Pan left/right to rotate object left/right)
            // Y movement -> X rotation (Pan up/down to tilt object)
            rotation.y = (center.x - 0.5) * 3; // Range approx -1.5 to 1.5 radians
            rotation.x = (center.y - 0.5) * 2; // Range approx -1 to 1 radians
          }

          // 2. Calculate Distance between two index fingers (Tip: 8)
          if (results.landmarks.length === 2) {
            const h1 = results.landmarks[0][8];
            const h2 = results.landmarks[1][8];
            // Euclidean distance in normalized coords
            const dx = h1.x - h2.x;
            const dy = h1.y - h2.y;
            const dz = h1.z - h2.z;
            const rawDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            // Map raw distance (approx 0.05 to 0.8) to 0-1 factor
            distance = Math.min(Math.max((rawDist - 0.05) / 0.6, 0), 1);
          } else {
            distance = 0.5;
          }

          // 3. Detect Fist (Thumb tip 4, Index tip 8, Middle 12, Ring 16, Pinky 20)
          // Compare tips to wrist (0)
          let openFingers = 0;
          for (const hand of results.landmarks) {
            const wrist = hand[0];
            // Check if tips are far from wrist
            if (getDist(hand[8], wrist) > 0.3) openFingers++;
            if (getDist(hand[12], wrist) > 0.3) openFingers++;
            if (getDist(hand[16], wrist) > 0.3) openFingers++;
            if (getDist(hand[20], wrist) > 0.3) openFingers++;
          }
          // If no fingers are "open" (extended), assume fist
          if (openFingers === 0) {
            isFist = true;
          }
        }

        onUpdate({ isTracking, distance, isFist, center, rotation });
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  const getDist = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black/80 w-32 h-24 sm:w-48 sm:h-36 transition-opacity hover:opacity-100 opacity-80">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="hidden" // Hide raw video
      />
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={240} 
        className="w-full h-full object-cover"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold animate-pulse">
          Loading AI...
        </div>
      )}
    </div>
  );
};

export default HandController;