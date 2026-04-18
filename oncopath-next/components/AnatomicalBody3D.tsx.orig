'use client';

import React, { useRef, useMemo, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Center } from '@react-three/drei';
import * as THREE from 'three';
import { ANATOMY_MAPPING_3D, type OrganPosition3D } from '@/lib/anatomy3d';

/* ───────────────────────────────────────────────────────
   Types & Utilities
─────────────────────────────────────────────────────── */
export interface AnatomicalBody3DProps {
  risks: Record<string, number>;
}

interface OrganMarkerData {
  id: string;
  meta: OrganPosition3D;
  prob: number;
  color: THREE.Color;
}

interface AnatomyMetadataEntry {
  URL?: string;
  Index?: number;
  RegionPath?: string;
}

interface AnatomyMeshEntry {
  vertices?: number[];
  faces?: number[];
  normals?: number[];
}

function getRiskColor3D(prob: number): THREE.Color {
  const risk = prob * 100;
  if (risk > 70) return new THREE.Color('#ef4444');
  if (risk > 40) return new THREE.Color('#f59e0b');
  return new THREE.Color('#10b981');
}

function createMeshFromEntry(meshData: AnatomyMeshEntry | undefined, region: string): THREE.Mesh | null {
  if (!meshData) return null;

  const vs = meshData.vertices || [];
  const fs = meshData.faces || [];
  const ns = meshData.normals || [];

  if (vs.length === 0 || fs.length === 0) return null;

  const positions: number[] = [];
  const normals: number[] = [];

  let idx = 0;
  while (idx < fs.length) {
    const type = fs[idx];

    if (type === 40) {
      const v1 = fs[idx + 1];
      const v2 = fs[idx + 2];
      const v3 = fs[idx + 3];

      positions.push(vs[v1 * 3] * 0.01, vs[v1 * 3 + 1] * 0.01, vs[v1 * 3 + 2] * 0.01);
      positions.push(vs[v2 * 3] * 0.01, vs[v2 * 3 + 1] * 0.01, vs[v2 * 3 + 2] * 0.01);
      positions.push(vs[v3 * 3] * 0.01, vs[v3 * 3 + 1] * 0.01, vs[v3 * 3 + 2] * 0.01);

      const n1 = fs[idx + 7];
      const n2 = fs[idx + 8];
      const n3 = fs[idx + 9];
      normals.push(ns[n1 * 3], ns[n1 * 3 + 1], ns[n1 * 3 + 2]);
      normals.push(ns[n2 * 3], ns[n2 * 3 + 1], ns[n2 * 3 + 2]);
      normals.push(ns[n3 * 3], ns[n3 * 3 + 1], ns[n3 * 3 + 2]);
      idx += 10;
      continue;
    }

    if (type === 32) {
      const v1 = fs[idx + 1];
      const v2 = fs[idx + 2];
      const v3 = fs[idx + 3];

      positions.push(vs[v1 * 3] * 0.01, vs[v1 * 3 + 1] * 0.01, vs[v1 * 3 + 2] * 0.01);
      positions.push(vs[v2 * 3] * 0.01, vs[v2 * 3 + 1] * 0.01, vs[v2 * 3 + 2] * 0.01);
      positions.push(vs[v3 * 3] * 0.01, vs[v3 * 3 + 1] * 0.01, vs[v3 * 3 + 2] * 0.01);

      const n1 = fs[idx + 4];
      const n2 = fs[idx + 5];
      const n3 = fs[idx + 6];
      normals.push(ns[n1 * 3], ns[n1 * 3 + 1], ns[n1 * 3 + 2]);
      normals.push(ns[n2 * 3], ns[n2 * 3 + 1], ns[n2 * 3 + 2]);
      normals.push(ns[n3 * 3], ns[n3 * 3 + 1], ns[n3 * 3 + 2]);
      idx += 7;
      continue;
    }

    if (type === 0) {
      const v1 = fs[idx + 1];
      const v2 = fs[idx + 2];
      const v3 = fs[idx + 3];
      positions.push(vs[v1 * 3] * 0.01, vs[v1 * 3 + 1] * 0.01, vs[v1 * 3 + 2] * 0.01);
      positions.push(vs[v2 * 3] * 0.01, vs[v2 * 3 + 1] * 0.01, vs[v2 * 3 + 2] * 0.01);
      positions.push(vs[v3 * 3] * 0.01, vs[v3 * 3 + 1] * 0.01, vs[v3 * 3 + 2] * 0.01);
      idx += 4;
      continue;
    }

    if (type === 41 || type === 42 || type === 43) {
      idx += 11;
      continue;
    }

    if (type === 2) {
      idx += 5;
      continue;
    }

    break;
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    geom.computeVertexNormals();
  }

  const color = region.includes('Arteries') ? '#ef4444' :
    region.includes('Veins') ? '#3b82f6' :
      region.includes('Nerves') ? '#fbbf24' :
        region.includes('Bones') ? '#e5decd' :
          region.includes('Muscles') ? '#a33327' :
            region.includes('Skin') ? '#d4a574' : '#f87171';

  const mat = new THREE.MeshPhysicalMaterial({
    color: color,
    roughness: region.includes('Skin') ? 0.3 : 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = region;
  return mesh;
}

/* ───────────────────────────────────────────────────────
   Procedural ZygoteBody JSON Loader
─────────────────────────────────────────────────────── */
function AnatomyModelRawJSON({ activeSystem, skinOpacity }: { activeSystem: string, skinOpacity: number }) {
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    
    const loadParts = async () => {
      try {
        const metaRes = await fetch('/derivative/human_body_metadata.json', { signal: controller.signal });
        if (!metaRes.ok) {
          throw new Error(`Failed to load anatomy metadata: ${metaRes.status} ${metaRes.statusText}`);
        }

        const metadata = await metaRes.json() as AnatomyMetadataEntry[];
        if (!Array.isArray(metadata)) {
          throw new Error('Anatomy metadata payload is not an array');
        }

        const byUrl = new Map<string, AnatomyMetadataEntry[]>();
        for (const item of metadata) {
          const url = item.URL;
          if (!url) continue;

          const list = byUrl.get(url);
          if (list) {
            list.push(item);
          } else {
            byUrl.set(url, [item]);
          }
        }

        const urls = Array.from(byUrl.keys());
        if (urls.length === 0) {
          if (mounted) {
            setMeshes([]);
            setProgress(100);
          }
          return;
        }

        let loaded = 0;
        const total = urls.length;
        const payloadByUrl = new Map<string, AnatomyMeshEntry | AnatomyMeshEntry[]>();

        await Promise.all(urls.map(async (url) => {
          const res = await fetch(`/derivative/${url}`, { signal: controller.signal });
          if (!res.ok) {
            throw new Error(`Failed to load anatomy part "${url}": ${res.status} ${res.statusText}`);
          }

          const payload = await res.json() as AnatomyMeshEntry | AnatomyMeshEntry[];
          payloadByUrl.set(url, payload);

          loaded += 1;
          if (mounted) {
            setProgress(Math.round((loaded / total) * 100));
          }
        }));

        if (!mounted) return;

        const nextMeshes: THREE.Mesh[] = [];
        for (const item of metadata) {
          const url = item.URL;
          if (!url) continue;

          const payload = payloadByUrl.get(url);
          if (!payload) continue;

          const meshData = Array.isArray(payload)
            ? (typeof item.Index === 'number' ? payload[item.Index] : payload[0])
            : payload;

          const mesh = createMeshFromEntry(meshData, item.RegionPath || '');
          if (mesh) nextMeshes.push(mesh);
        }

        if (mounted) {
          setMeshes(nextMeshes);
          setProgress(100);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load anatomy data', error);
        }
      }
    };
    
    loadParts();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      });
    };
  }, [meshes]);

  // Sync visibility & opacity to Active System
  useEffect(() => {
    meshes.forEach((m) => {
      const region = m.name;
      const isSkin = region.includes('Skin');
      const mat = m.material as THREE.MeshPhysicalMaterial;

      let visible = false;
      if (activeSystem === 'all') {
        visible = true;
      } else if (activeSystem === 'skin') {
        visible = isSkin;
      } else if (activeSystem === 'muscular') {
        if (region.includes('Muscles') || region.includes('Bones')) visible = true;
      } else if (activeSystem === 'skeletal') {
        if (region.includes('Bones')) visible = true;
      } else if (activeSystem === 'circulatory') {
        if (region.includes('Arteries') || region.includes('Veins') || region.includes('Bones')) visible = true;
      } else if (activeSystem === 'nervous') {
        if (region.includes('Nerves') || region.includes('Bones')) visible = true;
      }

      m.visible = visible;

      // Handle Skin Translucency when multiple systems are shown
      if (isSkin) {
        if (activeSystem === 'all') {
          mat.opacity = skinOpacity;
          mat.depthWrite = skinOpacity > 0.99;
        } else {
          mat.opacity = 1.0;
          mat.depthWrite = true;
        }
      }
    });
  }, [meshes, activeSystem, skinOpacity]);

  return (
    <Center>
      <group rotation={[0, -Math.PI / 2, 0]} scale={0.7} position={[0, -0.6, 0]}>
        {meshes.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
      {progress < 100 && (
         <Html position={[0, 2, 0]} center>
           <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-lg border border-slate-700 shadow-xl text-center">
             <div className="text-white font-mono text-sm mb-1 whitespace-nowrap">
               Parsing Anatomy Base... {progress}%
             </div>
             <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
               <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
             </div>
           </div>
         </Html>
      )}
    </Center>
  );
}

/* ───────────────────────────────────────────────────────
   Pulsing Organ Risk Marker
─────────────────────────────────────────────────────── */
function OrganMarker({ data, isHovered, onHover, onUnhover }: { data: OrganMarkerData; isHovered: boolean; onHover: () => void; onUnhover: () => void; }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = Math.sin(t * 2 + data.prob * 10) * 0.15 + 1;
    const scale = isHovered ? 1.8 : pulse;

    if (meshRef.current) meshRef.current.scale.setScalar(scale);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 2.5);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(t * 1.5) * 0.08;
    }
    if (ringRef.current) {
      const ringPulse = ((t * 0.5) % 1);
      ringRef.current.scale.setScalar(1 + ringPulse * 2);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - ringPulse);
    }
  });

  return (
    <group position={data.meta.position}>
      <mesh ref={ringRef}>
        <ringGeometry args={[data.meta.size * 0.8, data.meta.size * 1.0, 32]} />
        <meshBasicMaterial color={data.color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[data.meta.size * 1.5, 16, 16]} />
        <meshBasicMaterial color={data.color} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef} onPointerOver={(e) => { e.stopPropagation(); onHover(); }} onPointerOut={onUnhover}>
        <sphereGeometry args={[data.meta.size, 16, 16]} />
        <meshPhysicalMaterial color={data.color} emissive={data.color} emissiveIntensity={isHovered ? 2 : 0.8} roughness={0.2} metalness={0.1} transparent opacity={0.9} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <Html position={[0, data.meta.size * 2.5, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: '10px', fontFamily: "'Inter', monospace", fontWeight: 700, color: `#${data.color.getHexString()}`, textShadow: `0 0 8px #${data.color.getHexString()}`, whiteSpace: 'nowrap', opacity: data.prob * 100 > 15 ? 0.9 : 0.5 }}>
          {Math.round(data.prob * 100)}%
        </div>
      </Html>
      {isHovered && (
        <Html position={[0, data.meta.size * 4.5, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px', padding: '12px 16px', minWidth: '200px', maxWidth: '260px', boxShadow: `0 0 30px rgba(0,0,0,0.5), 0 0 15px #${data.color.getHexString()}40` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: `#${data.color.getHexString()}`, boxShadow: `0 0 6px #${data.color.getHexString()}` }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>{data.meta.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1, height: '4px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', width: `${Math.min(data.prob * 100, 100)}%`, background: `#${data.color.getHexString()}` }} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: "'Inter', monospace", color: `#${data.color.getHexString()}` }}>
                {Math.round(data.prob * 100)}%
              </span>
            </div>
            <p style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.4, fontFamily: "'Inter', sans-serif", margin: 0 }}>{data.meta.description}</p>
            <div style={{ marginTop: '6px', fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{data.meta.system} System · {data.meta.region}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ───────────────────────────────────────────────────────
   Background particles
─────────────────────────────────────────────────────── */
function Particles({ count = 150 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (mesh.current) mesh.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#3b82f6" size={0.025} transparent opacity={0.3} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ───────────────────────────────────────────────────────
   Main Exported Component
─────────────────────────────────────────────────────── */
export function AnatomicalBody3D({ risks }: AnatomicalBody3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);
  
  // Restored UI State
  const [activeSystem, setActiveSystem] = useState<string>('all');
  const [skinOpacity, setSkinOpacity] = useState(0.4);

  const riskCount = useMemo(() => {
    const entries = Object.entries(risks);
    return {
      total: entries.length,
      high: entries.filter(([, p]) => p * 100 > 70).length,
      medium: entries.filter(([, p]) => p * 100 > 40 && p * 100 <= 70).length,
      low: entries.filter(([, p]) => p * 100 <= 40 && p * 100 >= 5).length,
    };
  }, [risks]);
  
  const organMarkers = useMemo<OrganMarkerData[]>(() => {
    return Object.entries(risks).map(([site, prob]) => {
      const meta = ANATOMY_MAPPING_3D[site];
      if (!meta || (prob as number * 100) < 3) return null;
      return { id: site, meta, prob: prob as number, color: getRiskColor3D(prob as number) };
    }).filter(Boolean) as OrganMarkerData[];
  }, [risks]);

  return (
    <div className="w-full h-full bg-[#030712] relative overflow-hidden">
      <Canvas camera={{ position: [0, 1.5, 7], fov: 45, near: 0.1, far: 100 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}>
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffffff" castShadow />
        <directionalLight position={[-5, 4, -5]} intensity={0.5} />
        <pointLight position={[0, 2, 6]} intensity={1} color="#e2e8f0" distance={15} />

        <group ref={groupRef} position={[0, -1, 0]}>
          <Suspense fallback={null}>
            <AnatomyModelRawJSON activeSystem={activeSystem} skinOpacity={skinOpacity} />
          </Suspense>

          {/* Restored Risk markers */}
          {organMarkers.map((marker) => (
            <OrganMarker key={marker.id} data={marker} isHovered={hoveredOrgan === marker.id} onHover={() => setHoveredOrgan(marker.id)} onUnhover={() => setHoveredOrgan(null)} />
          ))}
        </group>
        
        <Particles />
        <OrbitControls enablePan={true} minDistance={1} maxDistance={20} minPolarAngle={Math.PI * 0.1} maxPolarAngle={Math.PI * 0.9} enableDamping dampingFactor={0.05} autoRotate={true} autoRotateSpeed={0.5} />
      </Canvas>

      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, #030712 90%)' }} />

      {/* Restored Top-left controls */}
      <div className="absolute top-5 left-5 z-20 space-y-3">
        <div className="bg-[#0f172a]/70 backdrop-blur-xl rounded-xl border border-slate-800/40 p-3 shadow-xl">
           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Viewing Mode</div>
           <div className="flex flex-col gap-2">
             {[
               { id: 'all', label: 'All Systems' },
               { id: 'skin', label: 'Integumentary' },
               { id: 'muscular', label: 'Muscular' },
               { id: 'skeletal', label: 'Skeletal' },
               { id: 'circulatory', label: 'Circulatory' },
               { id: 'nervous', label: 'Nervous' }
             ].map(sys => (
               <button key={sys.id} onClick={() => setActiveSystem(sys.id)} className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all text-left ${activeSystem === sys.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 w-full' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                 {sys.label}
               </button>
             ))}
           </div>
        </div>

        {activeSystem === 'all' && (
          <div className="bg-[#0f172a]/70 backdrop-blur-xl rounded-xl border border-slate-800/40 p-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Skin Layer</span>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{Math.round(skinOpacity * 100)}%</span>
            </div>
            <input type="range" min={0} max={0.8} step={0.05} value={skinOpacity} onChange={(e) => setSkinOpacity(parseFloat(e.target.value))} className="w-full" style={{ width: '120px' }} />
          </div>
        )}
      </div>

      {/* Restored Bottom HUD */}
      <div className="absolute bottom-5 left-5 z-20">
        <div className="bg-[#0f172a]/70 backdrop-blur-xl rounded-xl border border-slate-800/40 p-3 shadow-xl">
          <div className="text-[9px] text-slate-500 uppercase tracking-[0.15em] font-semibold mb-2">Active Risk Sites</div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500/40" /><span className="text-[10px] text-slate-400 font-mono">{riskCount.high} high</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40" /><span className="text-[10px] text-slate-400 font-mono">{riskCount.medium} med</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" /><span className="text-[10px] text-slate-400 font-mono">{riskCount.low} low</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
