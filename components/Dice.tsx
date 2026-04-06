import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, PerspectiveCamera, Environment, ContactShadows, PresentationControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface DiceProps {
  value: number;
  isRolling: boolean;
  isMuted: boolean;
  volume: number;
}

// --- 3D DICE MODEL COMPONENT ---
const Pip = ({ position, rotation }: { position: [number, number, number], rotation?: [number, number, number] }) => (
  <mesh position={position} rotation={rotation}>
    <cylinderGeometry args={[0.15, 0.15, 0.1, 32]} />
    <meshStandardMaterial 
      color="#330000" 
      roughness={0.4} 
      metalness={0.1} 
    />
  </mesh>
);

const DiceModel = ({ value, isRolling, volume, isMuted }: DiceProps) => {
  const meshRef = useRef<THREE.Group>(null);
  
  // Audio for landing
  const audioContextRef = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => { audioContextRef.current?.close(); };
  }, []);

  const playLandSound = () => {
    if (isMuted || volume <= 0 || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    gain.gain.setValueAtTime(0.3 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  };

  // Map dice value to rotations
  const getRotationForValue = (val: number) => {
    switch (val) {
      case 1: return new THREE.Euler(0, 0, 0);
      case 2: return new THREE.Euler(0, Math.PI / 2, 0);
      case 3: return new THREE.Euler(0, Math.PI, 0);
      case 4: return new THREE.Euler(0, -Math.PI / 2, 0);
      case 5: return new THREE.Euler(-Math.PI / 2, 0, 0);
      case 6: return new THREE.Euler(Math.PI / 2, 0, 0);
      default: return new THREE.Euler(0, 0, 0);
    }
  };

  const lastRolling = useRef(isRolling);
  const landingTime = useRef(0);
  const rollStartTime = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    if (isRolling) {
      if (!lastRolling.current) {
        rollStartTime.current = time;
      }
      // Fast random rotation while rolling
      meshRef.current.rotation.x += delta * 15;
      meshRef.current.rotation.y += delta * 18;
      meshRef.current.rotation.z += delta * 12;
      
      // Dynamic jumping bounce
      const bounceSpeed = 10;
      const bounceHeight = 1.2;
      meshRef.current.position.y = Math.abs(Math.sin(time * bounceSpeed)) * bounceHeight;
      
      // Slight scale pulse while in air
      const scale = 1 + Math.abs(Math.sin(time * bounceSpeed)) * 0.1;
      meshRef.current.scale.set(scale, scale, scale);
      
      lastRolling.current = true;
    } else {
      if (lastRolling.current) {
        landingTime.current = time;
        playLandSound();
      }
      
      const target = getRotationForValue(value);
      const timeSinceLanding = time - landingTime.current;
      
      // Smoothly interpolate to target rotation
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, target.x, 0.15);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, target.y, 0.15);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, target.z, 0.15);
      
      // Landing impact: subtle bounce and settle
      if (timeSinceLanding < 0.5) {
        const impact = Math.exp(-timeSinceLanding * 10) * Math.cos(timeSinceLanding * 20) * 0.2;
        meshRef.current.position.y = impact;
        const settleScale = 1 - impact * 0.5;
        meshRef.current.scale.set(settleScale, settleScale, settleScale);
      } else {
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, 0.1);
        meshRef.current.scale.set(
          THREE.MathUtils.lerp(meshRef.current.scale.x, 1, 0.1),
          THREE.MathUtils.lerp(meshRef.current.scale.y, 1, 0.1),
          THREE.MathUtils.lerp(meshRef.current.scale.z, 1, 0.1)
        );
      }
      
      lastRolling.current = false;
    }
  });

  // Remove the old useEffect for sound since it's handled in useFrame now

  return (
    <group ref={meshRef}>
      {/* THE DICE BODY - ROUNDED OPAQUE IVORY STYLE */}
      <RoundedBox 
        args={[2, 2, 2]} 
        radius={0.2} 
        smoothness={4} 
        castShadow 
        receiveShadow
      >
        <meshPhysicalMaterial 
          color="#fdfcf0"
          roughness={0.1}
          metalness={0.05}
          reflectivity={0.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          sheen={0.5}
          sheenRoughness={0.2}
          sheenColor="#ffffff"
        />
      </RoundedBox>

      {/* PIPS (Dots) - Recessed into the faces (at 0.96 for cleaner look) */}
      {/* Face 1 (Front) */}
      <Pip position={[0, 0, 0.96]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Face 2 (Right) */}
      <group position={[0.96, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Pip position={[-0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* Face 3 (Back) */}
      <group position={[0, 0, -0.96]} rotation={[0, Math.PI, 0]}>
        <Pip position={[-0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* Face 4 (Left) */}
      <group position={[-0.96, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Pip position={[-0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[-0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* Face 5 (Top) */}
      <group position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Pip position={[-0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[-0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* Face 6 (Bottom) */}
      <group position={[0, -0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Pip position={[-0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[-0.45, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[-0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Pip position={[0.45, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
};

const Dice: React.FC<DiceProps> = React.memo(({ value, isRolling, isMuted, volume }) => {
  return (
    <div className="w-full h-[300px] md:h-[400px]">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={50} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <DiceModel value={value} isRolling={isRolling} volume={volume} isMuted={isMuted} />
        </Float>

        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4.5} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
});

export default Dice;
