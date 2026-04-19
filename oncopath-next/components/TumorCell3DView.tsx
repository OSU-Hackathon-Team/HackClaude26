'use client';

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import type { TreatmentPresetId } from '@/lib/timeline';

/* ─── Constants & Colors ────────────────────────────────────────────────── */
const COLOR_LOW = new THREE.Color(0x5a1030);
const COLOR_HIGH = new THREE.Color(0xb70f41);
const COLOR_VESSEL = new THREE.Color(0x300508);
const COLOR_RBC = new THREE.Color(0x8b0000);

/* ─── Blood Stream Component ────────────────────────────────────────────── */
function BloodStream() {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -50),
      new THREE.Vector3(0, 0, 50),
    ]);
    return new THREE.TubeGeometry(curve, 20, 10, 16, false);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Subtle pulsing of the vessel
    const pulse = 1 + Math.sin(t * 0.5) * 0.02;
    if (meshRef.current) {
      meshRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <mesh geometry={geometry} ref={meshRef}>
      <meshStandardMaterial 
        color={COLOR_VESSEL} 
        side={THREE.BackSide} 
        transparent 
        opacity={0.4} 
        roughness={0.2} 
        metalness={0.1}
      />
    </mesh>
  );
}

/* ─── Floating RBC Particles ────────────────────────────────────────────── */
function BloodParticles({ count = 100 }) {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        p[i * 3] = (Math.random() - 0.5) * 15;
        p[i * 3 + 1] = (Math.random() - 0.5) * 15;
        p[i * 3 + 2] = (Math.random() - 0.5) * 80 - 40;
    }
    return p;
  }, [count]);

  const pRef = useRef<THREE.Points>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!pRef.current) return;
    const positions = pRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
        // Move along Z axis (blood flow)
        positions[i * 3 + 2] += 0.2;
        if (positions[i * 3 + 2] > 40) positions[i * 3 + 2] = -40;
        
        // Add subtle Brownian-like drift
        positions[i * 3] += Math.sin(t + i) * 0.01;
        positions[i * 3 + 1] += Math.cos(t + i) * 0.01;
    }
    pRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <Points ref={pRef} positions={points} stride={3}>
      <PointMaterial
        transparent
        color={COLOR_RBC}
        size={0.15}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
}

/* ─── Malignant Material (Shader) ────────────────────────────────────────── */
const MalignantShader = {
  uniforms: {
    uTime: { value: 0 },
    uRisk: { value: 0 },
    uColorLow: { value: COLOR_LOW },
    uColorHigh: { value: COLOR_HIGH },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uRisk;
    varying vec3 vNormal;
    varying float vDisplacement;

    // Simple noise-like function
    float noise(vec3 p) {
      return sin(p.x * 2.0 + uTime * 2.0) * cos(p.y * 2.0 + uTime * 1.5) * sin(p.z * 2.0);
    }

    void main() {
      vNormal = normal;
      
      // Spikiness increases with risk
      float freq = 2.0 + uRisk * 8.0;
      float amp = 0.05 + uRisk * 0.6; // Increased amp for demo
      
      float d = noise(position * freq);
      vDisplacement = d;
      
      vec3 newPosition = position + normal * d * amp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uRisk;
    uniform vec3 uColorLow;
    uniform vec3 uColorHigh;
    varying vec3 vNormal;
    varying float vDisplacement;

    void main() {
      vec3 color = mix(uColorLow, uColorHigh, uRisk);
      // Add highlights based on displacement (spikes are brighter)
      color += vDisplacement * 0.3 * uRisk;
      
      float rim = 1.0 - max(dot(vNormal, vec3(0,0,1)), 0.0);
      color += pow(rim, 3.0) * 0.6 * uRisk;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

/* ─── Tumor Component ───────────────────────────────────────────────────── */
function DynamicTumor({ risk, month, baselineRisk }: any) {
  const obj = useLoader(OBJLoader, '/models/cancerous-blood-cell.obj');
  const groupRef = useRef<THREE.Group>(null!);

  const processedObj = useMemo(() => {
    const clone = obj.clone(true);
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        (node as THREE.Mesh).material = new THREE.ShaderMaterial({
          ...JSON.parse(JSON.stringify(MalignantShader)),
          uniforms: THREE.UniformsUtils.clone(MalignantShader.uniforms),
          transparent: true,
          side: THREE.DoubleSide,
        });
      }
    });
    return clone;
  }, [obj]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!processedObj) return;

    processedObj.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mat = (node as THREE.Mesh).material as THREE.ShaderMaterial;
        if (mat.uniforms) {
          mat.uniforms.uTime.value = t;
          mat.uniforms.uRisk.value = risk;
        }
      }
    });
    // Scale and rotate
    const s = 0.8 + risk * 1.5; // Grow significantly
    processedObj.scale.set(s, s, s);
    processedObj.rotation.y += 0.005 + risk * 0.01;
    processedObj.rotation.x += 0.002;
  });

  const deltaVsBase = Math.round((risk - (baselineRisk || 0)) * 100);
  const deltaColor = deltaVsBase > 0 ? '#fca5a5' : '#6ee7b7';

  return (
    <group ref={groupRef}>
      <primitive object={processedObj} />
      <Html position={[0, 8, 0]} center distanceFactor={12}>
        <div className="bg-zinc-950/80 backdrop-blur-md border border-blue-500/30 rounded-lg px-3 py-1.5 text-[10px] font-mono whitespace-nowrap shadow-xl text-white">
          <div className="font-bold">
            {month === 0 ? 'Diagnostic' : `Month ${month}`} · {(risk * 100).toFixed(1)}%
          </div>
          <div className="text-[9px]" style={{ color: deltaColor }}>
            Δ {deltaVsBase >= 0 ? '+' : ''}{deltaVsBase}% vs baseline
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ─── Public Component ─────────────────────────────────────────────────── */
export function TumorCell3DView({ risk, baselineRisk, treatment, month }: any) {
  return (
    <div className="relative w-full h-[260px] bg-[#060d1a] rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
      <Canvas camera={{ position: [0, 5, 20], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#440000" />
        
        <Suspense fallback={null}>
          <BloodStream />
          <BloodParticles count={150} />
          <DynamicTumor risk={risk} month={month} baselineRisk={baselineRisk} />
        </Suspense>

        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      
      {/* Treatment Indicator Overlay */}
      <div className="absolute top-3 right-3 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-[8px] font-mono uppercase tracking-widest text-zinc-400">
         Simulation Mode · {treatment ? treatment.replace(/_/g, ' ') : 'OBSERVATION'}
      </div>
    </div>
  );
}
