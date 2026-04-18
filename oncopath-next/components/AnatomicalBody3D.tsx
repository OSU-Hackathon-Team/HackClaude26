'use client';

import React, { useRef, useMemo, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Center, Bounds, useBounds } from '@react-three/drei';
import * as THREE from 'three';
import { ANATOMY_MAPPING_3D, type OrganPosition3D } from '@/lib/anatomy3d';

export interface SelectedStructure {
  id: string;
  name: string;
  system: string;
  isMarker: boolean;
  position: THREE.Vector3;
}

function CameraController({ selectedStructure, groupRef }: { selectedStructure: SelectedStructure | null, groupRef: React.RefObject<THREE.Group> }) {
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
            if (!childBox.isEmpty()) {
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
          // Tight framing padding so the organ is IMMENSE and takes up the entire 3D window
          targetDistance.current = Math.max(dist * 1.15, 2.0); 
        }
      } else {
        // FULL BODY - Calculate perfect dynamic bounds by isolating the "Skin" outer mesh layer strictly.
        // This solves the problem of invisible mathematical geometric skeletons destroying the bounds while ensuring exact height!
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
          // Apply padding margin scalar so it breathes slightly from the viewport edges
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

const ORGAN_CATEGORIES = [
  {
    name: "Major Vital Organs",
    items: ["DMETS_DX_LIVER", "DMETS_DX_LUNG", "DMETS_DX_CNS_BRAIN", "DMETS_DX_KIDNEY", "SYS_HEART"]
  },
  {
    name: "Skeletal & Structural",
    items: ["DMETS_DX_BONE", "DMETS_DX_SKIN", "DMETS_DX_HEAD_NECK", "DMETS_DX_PNS", "SYS_MUSCLES"]
  },
  {
    name: "Abdominal & Digestive",
    items: ["DMETS_DX_INTRA_ABDOMINAL", "DMETS_DX_BILIARY_TRACT", "DMETS_DX_BOWEL"]
  },
  {
    name: "Reproductive System",
    items: ["DMETS_DX_MALE_GENITAL", "DMETS_DX_FEMALE_GENITAL", "DMETS_DX_OVARY", "DMETS_DX_BREAST"]
  },
  {
    name: "Chest & Thoracic",
    items: ["DMETS_DX_PLEURA", "DMETS_DX_MEDIASTINUM"]
  },
  {
    name: "Systemic & Others",
    items: ["DMETS_DX_DIST_LN", "DMETS_DX_ADRENAL_GLAND", "DMETS_DX_BLADDER_UT", "SYS_ARTERIES", "SYS_VEINS", "SYS_SPINAL_NERVES", "DMETS_DX_UNSPECIFIED"]
  }
];

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
  mesh.userData = {
    isBaseMesh: true,
    region: region
  };
  return mesh;
}

/* ───────────────────────────────────────────────────────
   Procedural ZygoteBody JSON Loader
─────────────────────────────────────────────────────── */
function AnatomyModelRawJSON({ activeSystem, skinOpacity, selectedStructure, visibleMarkers = [], hoveredOrgan = null, setHoveredOrgan = () => {} }: { activeSystem: string, skinOpacity: number, selectedStructure: SelectedStructure | null, visibleMarkers?: any[], hoveredOrgan?: string | null, setHoveredOrgan?: (id: string | null) => void }) {
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
      mat.emissive.setHex(0x000000);

      if (selectedStructure) {
        const id = selectedStructure.id;
        let isMatch = false;

        // Base Mesh Map
        if (id === 'DMETS_DX_SKIN' && region.includes('Skin')) isMatch = true;
        if (id === 'DMETS_DX_BONE' && region.includes('Bones')) isMatch = true;
        
        // Respiratory & Heart
        if (id === 'DMETS_DX_LUNG' && region.includes('Lungs')) isMatch = true;
        if (id === 'DMETS_DX_PLEURA' && region.includes('Lungs')) isMatch = true; // proxy
        if (id === 'SYS_HEART' && region.includes('Heart')) isMatch = true;
        
        // CNS & PNS
        if (id === 'DMETS_DX_CNS_BRAIN' && region.includes('Brainstem')) isMatch = true;
        if (id === 'DMETS_DX_PNS' && region.includes('Nerves')) isMatch = true;
        if (id === 'SYS_SPINAL_NERVES' && region.includes('Spinal nerves')) isMatch = true;
        
        // Digestive & Urinary
        if (id === 'DMETS_DX_BLADDER_UT' && region.includes('Bladder')) isMatch = true;
        if (['DMETS_DX_BOWEL', 'DMETS_DX_LIVER', 'DMETS_DX_BILIARY_TRACT', 'DMETS_DX_INTRA_ABDOMINAL'].includes(id) && region.includes('Gastrointestinal')) isMatch = true;
        if (['DMETS_DX_KIDNEY', 'DMETS_DX_ADRENAL_GLAND'].includes(id) && region.includes('Gastrointestinal')) isMatch = true; // Fallback mapping

        // Muscular & Vascular
        if (id === 'SYS_MUSCLES' && region.includes('Muscles')) isMatch = true;
        if (id === 'SYS_ARTERIES' && region.includes('Arteries')) isMatch = true;
        if (id === 'SYS_VEINS' && region.includes('Veins')) isMatch = true;

        // Reproductive & Others (Map to Skin or Bladder to avoid a completely blank screen)
        if (['DMETS_DX_BREAST', 'DMETS_DX_MALE_GENITAL', 'DMETS_DX_FEMALE_GENITAL', 'DMETS_DX_OVARY', 'DMETS_DX_DIST_LN', 'DMETS_DX_UNSPECIFIED'].includes(id)) {
            if (region.includes('Skin') || region.includes('Bladder')) isMatch = true;
        }

        if (isMatch) {
           m.visible = true;
           mat.opacity = 1.0;
           mat.depthWrite = true;
           mat.transparent = false;
           mat.emissive.setHex(0x222222); // subtle glow
        } else {
           m.visible = false; // Hide completely as requested
        }
      } else {
        // Normal behavior
        if (isSkin) {
          if (activeSystem === 'all') {
            mat.opacity = skinOpacity;
            mat.depthWrite = skinOpacity > 0.99;
          } else {
            mat.opacity = 1.0;
            mat.depthWrite = true;
          }
        } else {
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.transparent = true;
        }
      }
    });
  }, [meshes, activeSystem, skinOpacity, selectedStructure]);

  return (
    <>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={0.9} position={[0, -2.5, 0]}>
        {meshes.map((m, i) => (
          <primitive 
             key={i} 
             object={m} 
             onPointerOver={(e: any) => {
               e.stopPropagation();
               document.body.style.cursor = 'pointer';
             }}
             onPointerOut={(e: any) => {
               document.body.style.cursor = 'auto';
             }}
          />
        ))}

        {/* Dynamic Inner Markers (Undergo same Orientation+Scale transformations) */}
        {visibleMarkers.map((marker) => (
          <OrganMarker 
            key={marker.id} 
            data={marker} 
            isHovered={hoveredOrgan === marker.id} 
            isSelected={selectedStructure?.id === marker.id} 
            onHover={() => setHoveredOrgan(marker.id)} 
            onUnhover={() => setHoveredOrgan(null)} 
          />
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
    </>
  );
}

/* ───────────────────────────────────────────────────────
   Pulsing Organ Risk Marker
─────────────────────────────────────────────────────── */
function OrganMarker({ data, isHovered, isSelected, onHover, onUnhover }: { data: OrganMarkerData; isHovered: boolean; isSelected: boolean; onHover: () => void; onUnhover: () => void; }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const markerTextVisible = data.prob > 0;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = Math.sin(t * 2 + data.prob * 10) * 0.15 + 1;
    const scale = isSelected ? 2.5 : isHovered ? 1.8 : pulse;

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
      <mesh ref={ringRef} userData={{ isMarker: true }}>
        <ringGeometry args={[data.meta.size * 0.8, data.meta.size * 1.0, 32]} />
        <meshBasicMaterial color={data.color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={glowRef} userData={{ isMarker: true }}>
        <sphereGeometry args={[data.meta.size * 1.5, 16, 16]} />
        <meshBasicMaterial color={data.color} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh 
        ref={meshRef} 
        onPointerOver={(e) => { e.stopPropagation(); onHover(); }} 
        onPointerOut={onUnhover}
        onClick={() => console.log('Marker clicked')}
        userData={{ isMarker: true }}
      >
        <sphereGeometry args={[data.meta.size, 32, 32]} />
        <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={isHovered || isSelected ? 2 : 0.8} />
      </mesh>
      {markerTextVisible && (
        <Html position={[0, data.meta.size * 2.5, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: '10px', fontFamily: "'Inter', monospace", fontWeight: 700, color: `#${data.color.getHexString()}`, textShadow: `0 0 8px #${data.color.getHexString()}`, whiteSpace: 'nowrap', opacity: data.prob * 100 > 15 ? 0.9 : 0.5 }}>
            {Math.round(data.prob * 100)}%
          </div>
        </Html>
      )}
      {isHovered && !isSelected && (
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
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
  const [modelRotation, setModelRotation] = useState<number>(0);

  const riskCount = useMemo(() => {
    const entries = Object.entries(risks);
    return {
      total: entries.length,
      high: entries.filter(([, p]) => p * 100 > 70).length,
      medium: entries.filter(([, p]) => p * 100 > 40 && p * 100 <= 70).length,
      low: entries.filter(([, p]) => p * 100 <= 40 && p * 100 >= 5).length,
    };
  }, [risks]);
  
  const allOrganMarkers = useMemo<OrganMarkerData[]>(() => {
    return Object.entries(ANATOMY_MAPPING_3D).map(([site, meta]) => {
      const prob = risks[site] || 0;
      return { id: site, meta, prob: prob as number, color: prob > 0 ? getRiskColor3D(prob as number) : new THREE.Color('#3b82f6') };
    });
  }, [risks]);

  const visibleMarkers = useMemo(() => {
    return allOrganMarkers.filter(m => m.prob > 0.03);
  }, [allOrganMarkers]);

  return (
    <div className="w-full h-full bg-[#030712] relative overflow-hidden flex justify-start items-stretch">
      
      {/* Viewport dynamically constrained to strictly the left workspace, protecting the sidebar. Flex and height explicit. */}
      <div className="relative w-[calc(100%-340px)] h-full flex-grow-0 flex-shrink-0">
        <Canvas 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          camera={{ position: [0, 0, 14], fov: 45 }} 
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          onPointerMissed={() => setSelectedStructure(null)}
        >
        <CameraController selectedStructure={selectedStructure} groupRef={groupRef} />
        
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffffff" castShadow />
        <directionalLight position={[-5, 4, -5]} intensity={0.5} color="#93c5fd" />
        <pointLight position={[0, 2, 6]} intensity={1.2} color="#e2e8f0" distance={15} />

        <group ref={groupRef} position={[0, -1, 0]} rotation={[0, modelRotation, 0]}>
          <Suspense fallback={null}>
              <AnatomyModelRawJSON 
                 activeSystem={activeSystem} 
                 skinOpacity={skinOpacity} 
                 selectedStructure={selectedStructure} 
                 visibleMarkers={visibleMarkers}
                 hoveredOrgan={hoveredOrgan}
                 setHoveredOrgan={setHoveredOrgan}
              />
          </Suspense>
        </group>
        
        <Particles />
        <OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={false} minDistance={1} maxDistance={20} minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} enableDamping dampingFactor={0.05} autoRotate={false} />
      </Canvas>
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, #030712 90%)' }} />

      {/* Z-Axis Rotation Slider */}
      <div className="absolute z-20 left-1/2 -translate-x-[calc(50%+170px)]" style={{ bottom: '20px' }}>
         <div className="bg-[#0f172a]/80 backdrop-blur-xl rounded-full border border-slate-700/50 px-6 py-3 flex items-center gap-4 shadow-xl">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Rotate Z-Axis</span>
            <input 
               type="range" 
               min="0" 
               max={Math.PI * 2} 
               step={0.01} 
               value={modelRotation} 
               onChange={(e) => setModelRotation(parseFloat(e.target.value))}
               className="w-[200px] accent-blue-500 cursor-pointer" 
            />
         </div>
      </div>

      {/* Restored Top-left controls -> Now moved to Bottom Right */}
      <div className="absolute z-20 space-y-3" style={{ bottom: '20px', right: '20px' }}>
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

        {activeSystem === 'all' && !selectedStructure && (
          <div className="bg-[#0f172a]/70 backdrop-blur-xl rounded-xl border border-slate-800/40 p-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Skin Layer</span>
              <span className="text-[10px] text-blue-400 font-mono font-bold">{Math.round(skinOpacity * 100)}%</span>
            </div>
            <input type="range" min={0} max={0.8} step={0.05} value={skinOpacity} onChange={(e) => setSkinOpacity(parseFloat(e.target.value))} className="w-full" style={{ width: '120px' }} />
          </div>
        )}
      </div>

      {/* Right Sidebar for Body Parts Selection */}
      <div className="absolute z-20 w-[300px] flex flex-col pointer-events-auto overflow-hidden bg-[#0f172a]/90 backdrop-blur-xl rounded-xl border border-slate-700/60 shadow-2xl" style={{ top: '80px', right: '20px', maxHeight: '70vh' }}>
         <div className="p-4 border-b border-slate-700/60 flex justify-between items-center bg-slate-800/40">
            <h3 className="text-[12px] text-blue-400 uppercase tracking-widest font-bold">Anatomical Map</h3>
            {selectedStructure && (
               <button onClick={() => { setSelectedStructure(null); setSkinOpacity(0); }} className="text-[10px] text-white px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors shadow shadow-blue-500/20 font-semibold uppercase tracking-wide">
                  Reset
               </button>
            )}
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {ORGAN_CATEGORIES.map(category => (
               <div key={category.name} className="mb-4">
                  <div className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] font-bold text-slate-500 mb-1 border-b border-slate-800/50">
                     {category.name}
                  </div>
                  <div className="space-y-0.5">
                     {category.items.map(itemId => {
                        const marker = allOrganMarkers.find(m => m.id === itemId);
                        if (!marker) return null;
                        const isSelected = selectedStructure?.id === marker.id;
                        
                        return (
                           <button 
                             key={marker.id}
                             onClick={() => {
                               if (isSelected) {
                                 setSelectedStructure(null);
                                 setSkinOpacity(0);
                               } else {
                                 setSelectedStructure({ id: marker.id, name: marker.meta.label, system: marker.meta.system, isMarker: true, position: new THREE.Vector3(...marker.meta.position).add(new THREE.Vector3(0, -1, 0)) });
                               }
                             }}
                             onMouseEnter={() => setHoveredOrgan(marker.id)}
                             onMouseLeave={() => setHoveredOrgan(null)}
                             className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all focus:outline-none flex items-center justify-between group ${isSelected ? 'bg-blue-600/30 border border-blue-500/40 shadow-[inset_0_0_15px_rgba(59,130,246,0.15)] text-blue-50' : 'border border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                           >
                              <div className="flex items-center gap-2.5">
                                 <div className={`w-1.5 h-1.5 rounded-full transition-shadow ${isSelected ? 'shadow-[0_0_8px_currentColor] scale-125' : 'group-hover:scale-110'}`} style={{ color: '#' + marker.color.getHexString(), backgroundColor: 'currentColor' }} />
                                 <span className={isSelected ? 'font-bold' : 'font-medium'}>{marker.meta.label}</span>
                              </div>
                              {marker.prob > 0 && <span className="text-[10px] font-mono opacity-60 bg-black/20 px-1.5 rounded">{Math.round(marker.prob * 100)}%</span>}
                           </button>
                        );
                     })}
                  </div>
               </div>
            ))}
         </div>
         <style dangerouslySetInnerHTML={{__html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 1); }
         `}} />
      </div>

      {/* Restored Bottom HUD */}
      <div className="absolute z-20" style={{ bottom: '20px', left: '20px' }}>
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
