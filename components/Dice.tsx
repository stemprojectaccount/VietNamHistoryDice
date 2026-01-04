import React, { useEffect, useRef, useState } from 'react';

interface DiceProps {
  value: number;
  isRolling: boolean;
  isMuted: boolean;
  volume: number;
}

const Dice: React.FC<DiceProps> = ({ value, isRolling, isMuted, volume }) => {
  const cubeRef = useRef<HTMLDivElement>(null);
  
  // Store accumulated rotation to ensure smooth forward spinning
  const rotationRef = useRef({ x: 0, y: 0, z: 0 });
  const prevRollingRef = useRef(false);
  
  // State for CSS Styles
  const [transformStyle, setTransformStyle] = useState('rotateX(-25deg) rotateY(35deg)');
  const [transitionStyle, setTransitionStyle] = useState('transform 1s');

  // --- AUDIO LOGIC (Web Audio API) ---
  const playDiceSound = (type: 'roll' | 'land') => {
    if (isMuted || volume <= 0) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const t = ctx.currentTime;

      // Helper: Create White Noise Buffer for realistic texture
      // Dice sounds are percussive noise, not tonal notes.
      const bufferSize = ctx.sampleRate * 2; // 2 seconds buffer
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Helper to play a noise burst
      const playNoiseBurst = (startTime: number, duration: number, filterFreq: number, gainVal: number) => {
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Filter to make it sound like plastic (Highpass/Bandpass)
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = filterFreq;

        const gain = ctx.createGain();
        
        // Envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.005); // Attack
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration); // Decay

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + duration + 0.1);
      };

      if (type === 'land') {
        // REALISTIC LANDING: Hard plastic impact
        // 1. Sharp Noise "Crack"
        playNoiseBurst(t, 0.08, 1200, 0.8 * volume);

        // 2. Lower Body "Thud" (Resonance)
        const oscLow = ctx.createOscillator();
        const gainLow = ctx.createGain();
        oscLow.type = 'triangle';
        oscLow.frequency.setValueAtTime(120, t);
        oscLow.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        
        gainLow.gain.setValueAtTime(0.6 * volume, t);
        gainLow.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        oscLow.connect(gainLow);
        gainLow.connect(ctx.destination);
        oscLow.start(t);
        oscLow.stop(t + 0.2);

      } else if (type === 'roll') {
        // REALISTIC ROLLING: Shaking in hand/cup
        // Multiple small, random noise bursts
        
        const count = 6; 
        for (let i = 0; i < count; i++) {
          const startTime = t + (Math.random() * 0.6);
          // Varying pitch/filter for chaos
          const freq = 800 + Math.random() * 1000;
          const vol = (0.1 + Math.random() * 0.2) * volume;
          const dur = 0.03 + Math.random() * 0.02;
          
          playNoiseBurst(startTime, dur, freq, vol);
        }
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const getTargetRotation = (val: number) => {
    switch(val) {
      case 1: return { x: 0, y: 0 };
      case 2: return { x: 0, y: -90 };
      case 3: return { x: 0, y: -180 };
      case 4: return { x: 0, y: 90 };
      case 5: return { x: -90, y: 0 };
      case 6: return { x: 90, y: 0 };
      default: return { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    // Only play sound on state change to avoid loops
    if (isRolling && !prevRollingRef.current) {
      playDiceSound('roll');
    } else if (!isRolling && prevRollingRef.current) {
      playDiceSound('land');
    }
    prevRollingRef.current = isRolling;

    if (isRolling) {
      // --- TOSS PHASE ---
      // More energetic spins (3-5 full rotations)
      const spins = 4 + Math.random() * 2;
      
      const randomSpinX = (Math.random() * 360 * spins) + 1080;
      const randomSpinY = (Math.random() * 360 * spins) + 1080;
      const randomSpinZ = (Math.random() * 90) - 45; // More tilt during air time

      rotationRef.current = {
        x: rotationRef.current.x + randomSpinX,
        y: rotationRef.current.y + randomSpinY,
        z: rotationRef.current.z + randomSpinZ
      };

      // cubic-bezier(0.1, 0.7, 0.1, 1) -> Fast start, smooth slow down at top
      setTransitionStyle('transform 1.2s cubic-bezier(0.1, 0.7, 0.1, 1)');
      
      // Toss Higher and Closer
      setTransformStyle(`translateY(-220px) scale(1.5) rotateX(${rotationRef.current.x}deg) rotateY(${rotationRef.current.y}deg) rotateZ(${rotationRef.current.z}deg)`);

    } else {
      // --- LANDING PHASE ---
      const base = getTargetRotation(value);
      
      const snapToGrid = (current: number, targetBase: number) => {
        const currentRotations = Math.floor(current / 360);
        return (currentRotations * 360) + targetBase + 1080; // Add extra spins to ensure forward motion
      };

      const finalX = snapToGrid(rotationRef.current.x, base.x);
      const finalY = snapToGrid(rotationRef.current.y, base.y);
      const finalZ = 0; // Always lands flat

      rotationRef.current = { x: finalX, y: finalY, z: finalZ };

      // Micro-tilt for realism (imperfect landing)
      const microTilt = (Math.random() - 0.5) * 6;

      // Elastic landing with bounce/squash
      setTransitionStyle('transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)');
      
      setTransformStyle(`translateY(0px) scale(1) rotateX(${finalX + microTilt}deg) rotateY(${finalY + microTilt}deg) rotateZ(${finalZ}deg)`);
    }
  }, [value, isRolling]);

  const renderFace = (faceNumber: number) => {
    const dots = [];
    const configs: {[key: number]: number[]} = {
      1: [4],
      2: [2, 6], 
      3: [2, 4, 6],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const visibleDots = configs[faceNumber] || [];
    for (let i = 0; i < 9; i++) {
      dots.push(
        <div key={i} className="dot">
          {visibleDots.includes(i) && <div className="dot-pip"></div>}
        </div>
      );
    }
    return dots;
  };

  return (
    <div className="my-10 scene mx-auto z-10">
      <div 
        ref={cubeRef}
        className="cube" 
        style={{ 
          transform: transformStyle,
          transition: transitionStyle
        }}
      >
        <div className="cube__face cube__face--1">{renderFace(1)}</div>
        <div className="cube__face cube__face--2">{renderFace(2)}</div>
        <div className="cube__face cube__face--3">{renderFace(3)}</div>
        <div className="cube__face cube__face--4">{renderFace(4)}</div>
        <div className="cube__face cube__face--5">{renderFace(5)}</div>
        <div className="cube__face cube__face--6">{renderFace(6)}</div>
      </div>
      
      {/* Shadow */}
      <div 
        className="dice-shadow" 
        style={{
          opacity: isRolling ? 0.2 : 0.5,
          transform: isRolling ? 'rotateX(90deg) scale(0.5)' : 'rotateX(90deg) scale(1)',
          // Match the cube transition for synchronized squash/stretch shadow effect
          transition: isRolling ? 'all 1.2s ease-out' : 'all 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)'
        }}
      ></div>
    </div>
  );
};

export default Dice;