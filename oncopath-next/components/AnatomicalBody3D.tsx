'use client';

import React, { useRef, useMemo, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ANATOMY_MAPPING_3D, type OrganPosition3D } from '@/lib/anatomy3d';
import type { PatientProfile } from '@/lib/api';
import { InSceneTumor } from '@/components/InSceneTumor';
import type { TreatmentPresetId } from '@/lib/timeline';
import { ORGAN_GEOMETRIES } from './anatomy/geometry-loader';

import { SeedSoilAnalysis } from '@/components/analysis/SeedSoilAnalysis';

const PROCEDURAL_ORGANS: Record<string, { size: number, pos: [number,number,number] }> = {
  'DMETS_DX_LIVER': { size: 0.15, pos: [-0.15, 1.6, 0.2] },
  'DMETS_DX_KIDNEY': { size: 0.12, pos: [0, 1.7, -0.15] },
  'DMETS_DX_MALE_GENITAL': { size: 0.15, pos: [0, 0.3, 0.1] },
  'DMETS_DX_OVARY': { size: 0.15, pos: [0, 0.5, 0.1] },
  'DMETS_DX_FEMALE_GENITAL': { size: 0.15, pos: [0, 0.5, 0.1] },
  'DMETS_DX_CNS_BRAIN': { size: 0.14, pos: [0, 4.4, 0.05] },
  'DMETS_DX_BREAST': { size: 0.16, pos: [0, 2.35, 0.45] }
};

function ProceduralOrgan({ id }: { id: string }) {
  const config = PROCEDURAL_ORGANS[id];
  if (!config) return null;

  return (
    <group position={new THREE.Vector3(...config.pos)} scale={new THREE.Vector3(config.size, config.size, config.size)}>
      {id === 'DMETS_DX_LIVER' && (
        <mesh position={[0.2, -0.2, 0]} rotation={[0.2, 0.2, 0.1]} geometry={ORGAN_GEOMETRIES.liver}>
          <meshPhysicalMaterial color="#5c2018" roughness={0.3} clearcoat={0.6} sheenColor="#ff7b63" sheen={1} />
        </mesh>
      )}

      {id === 'DMETS_DX_KIDNEY' && (
        <group>
          <mesh position={[-0.8, 0, 0]} rotation={[0.1, -0.3, 0.2]} scale={[0.5, 0.5, 0.5]} geometry={ORGAN_GEOMETRIES.kidney}>
            <meshPhysicalMaterial color="#4a1a13" roughness={0.4} clearcoat={0.2} sheenColor="#a33427" sheen={0.8} />
          </mesh>
          <mesh position={[0.8, -0.2, 0]} rotation={[0.1, 0.3, -0.2]} scale={[-0.5, 0.5, 0.5]} geometry={ORGAN_GEOMETRIES.kidney}>
            <meshPhysicalMaterial color="#4a1a13" roughness={0.4} clearcoat={0.2} sheenColor="#a33427" sheen={0.8} />
          </mesh>
        </group>
      )}

      {id === 'DMETS_DX_CNS_BRAIN' && (
        <group>
          <mesh position={[-0.45, 0, 0]} geometry={ORGAN_GEOMETRIES.brain}>
            <meshPhysicalMaterial color="#baa1a4" roughness={0.6} clearcoat={0.3} transmission={0.1} thickness={0.5} />
          </mesh>
          <mesh position={[0.45, 0, 0]} scale={[-1, 1, 1]} geometry={ORGAN_GEOMETRIES.brain}>
            <meshPhysicalMaterial color="#baa1a4" roughness={0.6} clearcoat={0.3} transmission={0.1} thickness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export interface SelectedStructure {
  id: string;
  name: string;
  system: string;
  isMarker: boolean;
  position: THREE.Vector3;
}

function CameraController({ selectedStructure, groupRef }: { selectedStructure: SelectedStructure | null, groupRef: React.RefObject<THREE.Group | null> }) {
  const { camera, controls, size } = useThree() as any;
  const targetCenter = useRef(new THREE.Vector3(0, 0, 0));
  const targetDistance = useRef(11);

  useEffect(() => {
    if (!groupRef.current) return;
    
    setTimeout(() => {
      if (!groupRef.current) return;
      const box = new THREE.Box3();
      groupRef.current.updateMatrixWorld(true);

      if (selectedStructure) {
        let hasVisible = false;
        groupRef.current.traverse((child: any) => {
          if (child.isMesh && child.visible && !child.userData?.isMarker) {
            const childBox = new THREE.Box3().setFromObject(child);
            if (!childBox.isEmpty() && isFinite(childBox.min.x)) {
               box.union(childBox);
               hasVisible = true;
            }
          }
        });

        if (hasVisible) {
          box.getCenter(targetCenter.current);
          const boxSize = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
          const fov = camera.fov * (Math.PI / 180);
          
          let dist = Math.abs(maxDim / Math.sin(fov / 2));
          const effectiveAspect = (size.width * 0.66) / size.height;
          const hFov = 2 * Math.atan(Math.tan(fov / 2) * effectiveAspect);
          const horizontalDist = Math.abs(maxDim / Math.sin(hFov / 2));
          
          dist = Math.max(dist, horizontalDist);
          targetDistance.current = Math.max(dist * 1.15, 2.0); 
        }
      } else {
        const humanBox = new THREE.Box3();
        let foundSkin = false;
        groupRef.current.traverse((child: any) => {
          if (child.isMesh && child.name.includes('Skin') && !child.userData?.isMarker) {
             const childBox = new THREE.Box3().setFromObject(child);
             if (!childBox.isEmpty()) {
                humanBox.union(childBox);
                foundSkin = true;
             }
          }
        });

        if (foundSkin) {
          humanBox.getCenter(targetCenter.current);
          const boxSize = humanBox.getSize(new THREE.Vector3());
          const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
          const fov = camera.fov * (Math.PI / 180);
          
          let dist = Math.abs(maxDim / Math.sin(fov / 2));
          targetDistance.current = Math.max(dist * 0.95, 8.0); 
        } else {
          targetCenter.current.set(0, -1.0, 0);
          targetDistance.current = 15;
        }
      }
    }, 50);
  }, [selectedStructure, camera.fov, size, groupRef]);

  useFrame(() => {
    if (controls) {
      controls.target.lerp(targetCenter.current, 0.05);
      
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      if (offset.lengthSq() > 0.001) {
        offset.normalize().multiplyScalar(targetDistance.current);
        const idealPos = new THREE.Vector3().copy(controls.target).add(offset);
        camera.position.lerp(idealPos, 0.05);
      }
      controls.update();
    }
  });

  return null;
}

export interface AnatomicalBody3DProps {
  risks: Record<string, number>;
  profile?: PatientProfile;
  onOrganSelect?: (organId: string, name: string, clientX: number, clientY: number) => void;
  selectedMonth?: number;
  selectedTreatment?: string;
  baselineRisk?: number | null;
  primaryOrganId?: string;
}

const ORGAN_CATEGORIES = [
  { name: "Major Vital Organs", items: ["DMETS_DX_LIVER", "DMETS_DX_LUNG", "DMETS_DX_CNS_BRAIN", "DMETS_DX_KIDNEY", "SYS_HEART"] },
  { name: "Skeletal & Structural", items: ["DMETS_DX_BONE", "DMETS_DX_SKIN", "DMETS_DX_HEAD_NECK", "DMETS_DX_PNS", "SYS_MUSCLES"] },
  { name: "Abdominal & Digestive", items: ["DMETS_DX_INTRA_ABDOMINAL", "DMETS_DX_BILIARY_TRACT", "DMETS_DX_BOWEL"] },
  { name: "Reproductive System", items: ["DMETS_DX_MALE_GENITAL", "DMETS_DX_FEMALE_GENITAL", "DMETS_DX_OVARY", "DMETS_DX_BREAST"] },
  { name: "Chest & Thoracic", items: ["DMETS_DX_PLEURA", "DMETS_DX_MEDIASTINUM"] },
  { name: "Systemic & Others", items: ["DMETS_DX_DIST_LN", "DMETS_DX_ADRENAL_GLAND", "DMETS_DX_BLADDER_UT", "SYS_ARTERIES", "SYS_VEINS", "SYS_SPINAL_NERVES", "DMETS_DX_UNSPECIFIED"] }
];

function getRiskColor3D(prob: number): THREE.Color {
  const risk = prob * 100;
  if (risk > 70) return new THREE.Color('#ef4444');
  if (risk > 40) return new THREE.Color('#f59e0b');
  return new THREE.Color('#10b981');
}

function createMeshFromEntry(meshData: any, region: string, skinOpacity: number): THREE.Mesh | null {
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
      const v1 = fs[idx + 1], v2 = fs[idx + 2], v3 = fs[idx + 3];
      positions.push(vs[v1*3]*0.01,vs[v1*3+1]*0.01,vs[v1*3+2]*0.01, vs[v2*3]*0.01,vs[v2*3+1]*0.01,vs[v2*3+2]*0.01, vs[v3*3]*0.01,vs[v3*3+1]*0.01,vs[v3*3+2]*0.01);
      const n1 = fs[idx+7], n2 = fs[idx+8], n3 = fs[idx+9];
      normals.push(ns[n1*3],ns[n1*3+1],ns[n1*3+2], ns[n2*3],ns[n2*3+1],ns[n2*3+2], ns[n3*3],ns[n3*3+1],ns[n3*3+2]);
      idx += 10; continue;
    }
    if (type === 32) {
      const v1 = fs[idx + 1], v2 = fs[idx + 2], v3 = fs[idx + 3];
      positions.push(vs[v1*3]*0.01,vs[v1*3+1]*0.01,vs[v1*3+2]*0.01, vs[v2*3]*0.01,vs[v2*3+1]*0.01,vs[v2*3+2]*0.01, vs[v3*3]*0.01,vs[v3*3+1]*0.01,vs[v3*3+2]*0.01);
      const n1 = fs[idx+4], n2 = fs[idx+5], n3 = fs[idx+6];
      normals.push(ns[n1*3],ns[n1*3+1],ns[n1*3+2], ns[n2*3],ns[n2*3+1],ns[n2*3+2], ns[n3*3],ns[n3*3+1],ns[n3*3+2]);
      idx += 7; continue;
    }
    if (type === 0) {
      const v1 = fs[idx+1], v2 = fs[idx+2], v3 = fs[idx+3];
      positions.push(vs[v1*3]*0.01,vs[v1*3+1]*0.01,vs[v1*3+2]*0.01, vs[v2*3]*0.01,vs[v2*3+1]*0.01,vs[v2*3+2]*0.01, vs[v3*3]*0.01,vs[v3*3+1]*0.01,vs[v3*3+2]*0.01);
      idx += 4; continue;
    }
    if (type === 41 || type === 42 || type === 43) { idx += 11; continue; }
    if (type === 2) { idx += 5; continue; }
    break;
  }
  if (positions.length === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geom.computeVertexNormals();

  const getColor = () => {
    if (region.includes('Arteries')) return '#ef4444';
    if (region.includes('Veins')) return '#1e40af';
    if (region.includes('Nerves')) return '#eab308';
    if (region.includes('Bones')) return '#f5f5f0';
    if (region.includes('Muscles')) return '#8b0000';
    if (region.includes('Skin')) return '#d4a574';
    return '#f43f5e';
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: getColor(),
    roughness: region.includes('Bones') ? 0.9 : 0.45,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: region.includes('Skin') ? skinOpacity : 1.0,
    depthWrite: true,
    sheen: region.includes('Bones') || region.includes('Skin') ? 0 : 0.8,
    sheenRoughness: 0.2,
    sheenColor: new THREE.Color('#ffffff'),
    ior: 1.45,
    thickness: 0.5,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = region;
  mesh.userData = { isBaseMesh: true, region: region };
  return mesh;
}

function AnatomyModelRawJSON({ activeSystem, skinOpacity, selectedStructure, risks = {}, rotationZ = 0 }: any) {
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const loadParts = async () => {
      try {
        const metaRes = await fetch('/derivative/human_body_metadata.json', { signal: controller.signal });
        const metadata = await metaRes.json();
        const urls = Array.from(new Set(metadata.map((m: any) => m.URL).filter(Boolean))) as string[];
        let loaded = 0;
        const payloadByUrl = new Map();
        await Promise.all(urls.map(async (url) => {
          const res = await fetch(`/derivative/${url}`, { signal: controller.signal });
          payloadByUrl.set(url, await res.json());
          loaded += 1;
          if (mounted) setProgress(Math.round((loaded / urls.length) * 100));
        }));
        if (!mounted) return;
        const nextMeshes = [];
        for (const item of metadata) {
          const payload = payloadByUrl.get(item.URL);
          if (!payload) continue;
          const meshData = Array.isArray(payload) ? (typeof item.Index === 'number' ? payload[item.Index] : payload[0]) : payload;
          const mesh = createMeshFromEntry(meshData, item.RegionPath || '', skinOpacity);
          if (mesh) nextMeshes.push(mesh);
        }
        if (mounted) { setMeshes(nextMeshes); setProgress(100); }
      } catch (e) { if (!controller.signal.aborted) console.error(e); }
    };
    loadParts();
    return () => { mounted = false; controller.abort(); };
  }, []);

  useEffect(() => {
    meshes.forEach((m) => {
      const region = m.name;
      const isSkin = region.includes('Skin');
      const mat = m.material as THREE.MeshPhysicalMaterial;
      let visible = activeSystem === 'all' || (activeSystem === 'skin' && isSkin) || (activeSystem === 'muscular' && (region.includes('Muscles') || region.includes('Bones'))) || (activeSystem === 'skeletal' && region.includes('Bones')) || (activeSystem === 'circulatory' && (region.includes('Arteries') || region.includes('Veins') || region.includes('Bones'))) || (activeSystem === 'nervous' && (region.includes('Nerves') || region.includes('Bones')));
      if (selectedStructure) {
        const id = selectedStructure.id;
        const isMatch = (id === 'DMETS_DX_SKIN' && region.includes('Skin')) || (id === 'DMETS_DX_BONE' && region.includes('Bones')) || (id === 'DMETS_DX_LUNG' && region.includes('Lungs')) || (id === 'SYS_HEART' && region.includes('Heart')) || (id === 'DMETS_DX_CNS_BRAIN' && region.includes('Brainstem')) || (['DMETS_DX_BOWEL', 'DMETS_DX_LIVER'].includes(id) && region.includes('Gastrointestinal'));
        visible = isMatch;
        mat.opacity = isMatch ? 1.0 : 0.1;
      } else {
        mat.opacity = isSkin ? skinOpacity : 1.0;
      }
      m.visible = visible;
    });
  }, [meshes, activeSystem, skinOpacity, selectedStructure, risks]);

  return (
    <group rotation={[-Math.PI / 2, 0, rotationZ]} scale={0.9} position={[0, -2.5, 0]}>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
      {Object.keys(PROCEDURAL_ORGANS).map(id => <ProceduralOrgan key={id} id={id} />)}
      {progress < 100 && (
        <Html position={[0, 2, 0]} center>
          <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-lg border border-slate-700 shadow-xl text-white font-mono text-sm">
            Loading Anatomy... {progress}%
          </div>
        </Html>
      )}
    </group>
  );
}

function Particles() {
  const points = useMemo(() => {
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
        arr[i*3] = (Math.random()-0.5)*20;
        arr[i*3+1] = (Math.random()-0.5)*20;
        arr[i*3+2] = (Math.random()-0.5)*20;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={500} array={points} itemSize={3} /></bufferGeometry>
      <pointsMaterial color="#3b82f6" size={0.03} transparent opacity={0.3} depthWrite={false} />
    </points>
  );
}

export function AnatomicalBody3D({ risks, profile, onOrganSelect, selectedMonth = 0, selectedTreatment = 'OBSERVATION', baselineRisk = null, primaryOrganId }: AnatomicalBody3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [activeSystem, setActiveSystem] = useState('all');
  const [skinOpacity, setSkinOpacity] = useState(0.4);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
  const [rotationZ, setRotationZ] = useState(0);

  useEffect(() => {
    if (primaryOrganId && risks[primaryOrganId] && risks[primaryOrganId] > 0.05) setSkinOpacity((prev) => Math.min(prev, 0.22));
  }, [primaryOrganId, risks]);

  return (
    <div className="w-full h-full bg-zinc-950 relative overflow-hidden">
      <Canvas camera={{ position: [0, 0, 14], fov: 45 }}>
        <CameraController selectedStructure={selectedStructure} groupRef={groupRef} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />
        <group ref={groupRef} position={[0, -1, 0]}>
          <Suspense fallback={null}>
            <AnatomyModelRawJSON activeSystem={activeSystem} skinOpacity={skinOpacity} selectedStructure={selectedStructure} risks={risks} rotationZ={rotationZ} />
          </Suspense>
          {primaryOrganId && ANATOMY_MAPPING_3D[primaryOrganId] && (
            <Suspense fallback={null}>
              <InSceneTumor risk={risks[primaryOrganId] || 0} baselineRisk={baselineRisk ?? 0} treatment={selectedTreatment as TreatmentPresetId} month={selectedMonth} position={ANATOMY_MAPPING_3D[primaryOrganId].position} />
            </Suspense>
          )}
        </group>
        <Particles />
        <OrbitControls enableRotate={true} />
      </Canvas>
      <div className="absolute top-20 left-5 z-20 space-y-3">
        <div className="bg-zinc-900/80 backdrop-blur p-3 rounded-xl border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Systems</div>
          <div className="flex flex-col gap-1.5">
            {['all', 'skin', 'muscular', 'skeletal', 'circulatory', 'nervous'].map(s => (
              <button key={s} onClick={() => setActiveSystem(s)} className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold transition-all text-left ${activeSystem === s ? 'bg-orange-600 text-white' : 'bg-zinc-800/50 text-zinc-400'}`}>{s}</button>
            ))}
          </div>
          <div className="pt-4 mt-4 border-t border-zinc-800">
             <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Orientation</div>
             <input type="range" min={-Math.PI} max={Math.PI} step={0.01} value={rotationZ} onChange={(e) => setRotationZ(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
          </div>
        </div>
      </div>
      <div className="absolute top-20 right-6 z-20 w-[300px] bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
         <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/40">
            <h3 className="text-[12px] text-zinc-100 uppercase font-bold">Anatomical Map</h3>
            {selectedStructure && <button onClick={() => setSelectedStructure(null)} className="text-[10px] px-3 py-1.5 rounded-md bg-zinc-700 text-white font-bold uppercase">Reset</button>}
         </div>
         <div className="max-h-[60vh] overflow-y-auto p-2">
            {ORGAN_CATEGORIES.map(cat => (
              <div key={cat.name} className="mb-4">
                <div className="px-3 py-2 text-[9px] uppercase font-bold text-zinc-500 border-b border-zinc-800/50">{cat.name}</div>
                <div className="grid grid-cols-1 gap-1 p-1">
                  {cat.items.map(id => {
                    const label = id.replace('DMETS_DX_', '').replace('SYS_', '').replace(/_/g, ' ');
                    const riskVal = risks[id] || 0;
                    const riskPct = (riskVal * 100).toFixed(1);
                    const isSelected = selectedStructure?.id === id;
                    
                    return (
                      <div key={id} className="flex items-center gap-1">
                        <button 
                          onClick={() => { 
                            setSelectedStructure({ id, name: label.toUpperCase(), system: cat.name, isMarker: false, position: new THREE.Vector3() }); 
                            onOrganSelect?.(id, label.toUpperCase(), 0, 0); 
                          }} 
                          className={`flex-1 flex justify-between items-center px-3 py-2 rounded-lg text-left text-[11px] font-medium transition-all ${isSelected ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:bg-zinc-800'}`}
                        >
                          <span className="capitalize">{label.toLowerCase()}</span>
                          {riskVal > 0 && (
                            <span className={`font-mono text-[9px] font-bold ${riskVal > 0.6 ? 'text-red-400' : riskVal > 0.3 ? 'text-orange-400' : 'text-emerald-400'}`}>
                              {riskPct}%
                            </span>
                          )}
                        </button>
                        {profile && riskVal > 0.3 && (
                          <div className="pr-1">
                            <SeedSoilAnalysis organKey={id} riskScore={riskVal} profile={profile} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
