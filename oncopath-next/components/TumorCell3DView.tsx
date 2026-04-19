'use client';

/**
 * TumorCell3DView
 * ---------------
 * What this file is:
 *   A React Three Fiber (R3F) Canvas component that renders the cancerous blood
 *   cell OBJ model (`/models/cancerous-blood-cell.obj`) inside a self-contained
 *   WebGL viewport.
 *
 * Its purpose (Seed and Soil context):
 *   This component translates the abstract "risk score" on the timeline into a
 *   visceral, biological visual. As the month scrubber advances, the cancer "Seed"
 *   visually grows or shrinks based on the treatment's effect — making the Gompertz
 *   decay curve tangible rather than just a number.
 *
 * Learning Points:
 *   - `useLoader(OBJLoader, url)` integrates with R3F's Suspense pipeline.
 *   - Vertex displacement (addCancerLikeIrregularities) is computed once at load time,
 *     not per-frame — heavy geometry mutations must never happen in the render loop.
 *   - Frame-by-frame reactivity (color, scale, glow) is cheap: just updating material
 *     and transform uniforms on the GPU, no CPU geometry work.
 */

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import type { TreatmentPresetId } from '@/lib/timeline';

/* ─── Constants ─────────────────────────────────────────────────────────── */

// Baseline cancer-cell color (dark crimson) — same crimson as viewer.js
const COLOR_LOW  = new THREE.Color(0x5a1030);
// High-risk color (bright malignant red)
const COLOR_HIGH = new THREE.Color(0xb70f41);
// Healthy satellite cell color (erythrocyte pink-red)
const COLOR_HEALTHY = new THREE.Color(0xe8a080);

const HEALTHY_CELL_RADIUS = 0.28;
const TUMOR_FIT_SIZE      = 14; // world-units for the fit scale

/* ─── Geometry utilities ──────────────────────────────────────────────────
   Ported directly from ~/Documents/tumor/viewer.js — applies cancer-like
   surface irregularities to a BufferGeometry via normal-displacement.
   Called ONCE after OBJ load, never inside useFrame.
─────────────────────────────────────────────────────────────────────────── */

function addCancerLikeIrregularities(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  if (!position) return;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const normal = geometry.attributes.normal;
  const vertex = new THREE.Vector3();
  const outward = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    outward.fromBufferAttribute(normal, i).normalize();

    const wave =
      Math.sin(vertex.x * 2.3) +
      Math.cos(vertex.y * 2.9) +
      Math.sin(vertex.z * 2.1);
    const displacement = wave * 0.05;

    position.setXYZ(
      i,
      vertex.x + outward.x * displacement,
      vertex.y + outward.y * displacement,
      vertex.z + outward.z * displacement,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

/* ─── Treatment effect helpers ───────────────────────────────────────────── */

type TreatmentAura = {
  color: THREE.Color;
  pulseSpeed: number;
  intensity: number;
};

const TREATMENT_AURA: Record<TreatmentPresetId, TreatmentAura> = {
  CHEMOTHERAPY:     { color: new THREE.Color(0x00ddcc), pulseSpeed: 2.2, intensity: 1.2 },
  IMMUNOTHERAPY:    { color: new THREE.Color(0xffd700), pulseSpeed: 1.6, intensity: 0.9 },
  TARGETED_THERAPY: { color: new THREE.Color(0xa78bfa), pulseSpeed: 3.0, intensity: 1.4 },
  RADIATION:        { color: new THREE.Color(0xffffff), pulseSpeed: 4.0, intensity: 1.6 },
  OBSERVATION:      { color: new THREE.Color(0x334155), pulseSpeed: 0.8, intensity: 0.3 },
};

/* ─── Satellite healthy cells ─────────────────────────────────────────────
   Count scales inversely with risk — at risk=0 we have 6 healthy satellites,
   at risk=1 we have 0 (the cancer has overwhelmed them).
─────────────────────────────────────────────────────────────────────────── */

interface SatelliteProps {
  index: number;
  total: number;
  risk: number;
}

function HealthySatellite({ index, total, risk }: SatelliteProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Each satellite gets a unique orbit plane tilt and radius
  const { tiltX, tiltZ, radius, speed, phaseOffset } = useMemo(() => ({
    tiltX:       (index / total) * Math.PI,
    tiltZ:       (index / total) * Math.PI * 0.5,
    radius:      3.5 + (index % 3) * 1.5,
    speed:       0.25 + index * 0.07,
    phaseOffset: (index / total) * Math.PI * 2,
  }), [index, total]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const angle = t * speed + phaseOffset;

    // Orbit in a tilted circle
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle * tiltX) * radius * 0.35;
    const z = Math.sin(angle) * radius;

    meshRef.current.position.set(x, y, z);

    // Fade opacity based on risk (healthy cells disappear as risk grows)
    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
    mat.opacity = Math.max(0, (1 - risk) * 0.85);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[HEALTHY_CELL_RADIUS, 32, 32]} />
      <meshPhysicalMaterial
        color={COLOR_HEALTHY}
        roughness={0.4}
        clearcoat={0.8}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

/* ─── Treatment torus ring (Targeted Therapy) ─────────────────────────── */

function TreatmentRing({ treatment, risk }: { treatment: TreatmentPresetId; risk: number }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const aura = TREATMENT_AURA[treatment];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ringRef.current.rotation.x = t * 0.6;
    ringRef.current.rotation.z = t * 0.3;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = treatment === 'TARGETED_THERAPY' ? 0.5 - risk * 0.3 : 0;
  });

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[4.5, 0.06, 16, 80]} />
      <meshBasicMaterial color={aura.color} transparent opacity={0.4} />
    </mesh>
  );
}

/* ─── Treatment point light ───────────────────────────────────────────── */

function TreatmentLight({ treatment, risk }: { treatment: TreatmentPresetId; risk: number }) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const aura = TREATMENT_AURA[treatment];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = Math.sin(t * aura.pulseSpeed) * 0.5 + 0.5;
    lightRef.current.intensity = risk * aura.intensity * pulse;
    lightRef.current.color.copy(aura.color);
  });

  return <pointLight ref={lightRef} position={[0, -6, 0]} distance={20} intensity={0} />;
}

/* ─── Main tumor cell mesh ────────────────────────────────────────────── */

interface CancerCellMeshProps {
  risk: number;
  baselineRisk: number;
  treatment: TreatmentPresetId;
  month: number;
}

function CancerCellMesh({ risk, baselineRisk, treatment, month }: CancerCellMeshProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null!);

  // Load OBJ — useLoader integrates with Suspense
  const obj = useLoader(OBJLoader, '/models/cancerous-blood-cell.obj');

  // Process geometry once: center, scale, apply surface irregularities
  const { scaledGroup, baseScale } = useMemo(() => {
    const clone = obj.clone(true) as THREE.Group;

    // Apply cancer irregularities to every mesh geometry
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        addCancerLikeIrregularities(mesh.geometry);

        // Replace material with our risk-reactive one
        mesh.material = new THREE.MeshStandardMaterial({
          color:            COLOR_LOW.clone(),
          emissive:         new THREE.Color(0x2a0010),
          emissiveIntensity: 0.45,
          roughness:        0.6,
          metalness:        0.05,
          transparent:      true,
          opacity:          0.95,
          side:             THREE.DoubleSide,
        });
      }
      if ((node as THREE.Line).isLine) {
        (node as THREE.Line).material = new THREE.LineBasicMaterial({
          color: 0xff88b0, transparent: true, opacity: 0.25,
        });
      }
    });

    // Auto-center and fit to world units
    const box  = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3()).length();
    clone.position.sub(center);
    const bs = size > 0 ? TUMOR_FIT_SIZE / size : 1;
    clone.scale.setScalar(bs);
    clone.userData.baseScale = bs;

    return { scaledGroup: clone, baseScale: bs };
  }, [obj]);

  // Per-frame reactive animation: color, scale, glow
  const _color   = useMemo(() => new THREE.Color(), []);
  const _emissive = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Pulse: more agitated at higher risk
    const pulse      = 1 + Math.sin(t * 0.003 * 1000) * 0.015 * (1 + risk * 0.8);
    // Size scales with risk
    const riskScale  = 0.65 + risk * 0.65;
    groupRef.current.scale.setScalar(riskScale * pulse);

    // Spin — faster at higher risk
    groupRef.current.rotation.y += 0.0022 + risk * 0.003;

    // Update material on every mesh inside
    scaledGroup.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (!mat) return;

        // Color lerp: low-risk dark → high-risk crimson
        _color.copy(COLOR_LOW).lerp(COLOR_HIGH, risk);
        mat.color.copy(_color);

        // Emissive glow grows with risk
        _emissive.setHex(0x2a0010).lerp(new THREE.Color(0x8b0000), risk);
        mat.emissive.copy(_emissive);
        mat.emissiveIntensity = 0.2 + risk * 1.3;

        // Roughness: smoother surface at higher risk (malignant gloss)
        mat.roughness = 0.75 - risk * 0.25;
      }
    });
  });

  // Healthy satellite count — more satellites = lower risk
  const satelliteCount = Math.max(0, Math.round((1 - risk) * 6));

  // HUD overlay positioning
  const deltaVsBase = Math.round((risk - baselineRisk) * 100);
  const deltaStr = `${deltaVsBase >= 0 ? '+' : ''}${deltaVsBase}%`;
  const deltaColor = deltaVsBase > 0 ? '#fca5a5' : '#6ee7b7';

  return (
    <>
      {/* Tumor cell */}
      <group ref={groupRef}>
        <primitive object={scaledGroup} />
      </group>

      {/* Treatment ring (visible only for targeted therapy) */}
      <TreatmentRing treatment={treatment} risk={risk} />

      {/* Treatment aura light */}
      <TreatmentLight treatment={treatment} risk={risk} />

      {/* Healthy satellite cells */}
      {Array.from({ length: satelliteCount }, (_, i) => (
        <HealthySatellite key={i} index={i} total={Math.max(satelliteCount, 1)} risk={risk} />
      ))}

      {/* In-scene HUD */}
      <Html position={[0, 8.5, 0]} center distanceFactor={14}>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '10px',
          background: 'rgba(6,13,26,0.88)',
          border: '1px solid rgba(96,165,250,0.35)',
          borderRadius: '6px',
          padding: '5px 9px',
          color: 'rgba(191,219,254,0.9)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          lineHeight: '1.5',
        }}>
          <div style={{ fontWeight: 700 }}>
            {month === 0 ? 'Dx' : `M${month}`} · {Math.round(risk * 100)}%
          </div>
          <div style={{ color: deltaColor, fontSize: '9px' }}>
            Δ {deltaStr} vs baseline
          </div>
        </div>
      </Html>
    </>
  );
}

/* ─── Suspense fallback ───────────────────────────────────────────────── */

function CellLoadFallback() {
  return (
    <Html center>
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        color: 'rgba(148,163,184,0.7)',
        animation: 'pulse 1.5s ease-in-out infinite',
        whiteSpace: 'nowrap',
      }}>
        Loading cell model…
      </div>
    </Html>
  );
}

/* ─── Public component ────────────────────────────────────────────────── */

export interface TumorCell3DViewProps {
  risk: number;
  baselineRisk: number;
  treatment: TreatmentPresetId;
  month: number;
}

export function TumorCell3DView({ risk, baselineRisk, treatment, month }: TumorCell3DViewProps) {
  return (
    <div
      className="rounded-lg border border-slate-700/50 bg-[#060d1a] overflow-hidden"
      style={{ height: '260px' }}
    >
      <Canvas
        camera={{ fov: 55, position: [0, 5, 18], near: 0.1, far: 2000 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        {/* Lighting — ported from viewer.js */}
        <ambientLight intensity={0.45} />
        <directionalLight position={[22, 16, 10]} intensity={0.9} color="#ffffff" />
        <directionalLight position={[-18, 8, -16]} intensity={0.45} color="#80a6ff" />

        <Suspense fallback={<CellLoadFallback />}>
          <CancerCellMesh
            risk={risk}
            baselineRisk={baselineRisk}
            treatment={treatment}
            month={month}
          />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minDistance={4}
          maxDistance={80}
          enablePan={false}
        />
      </Canvas>
    </div>
  );
}
