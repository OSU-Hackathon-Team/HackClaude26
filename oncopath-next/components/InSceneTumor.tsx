'use client';

/**
 * InSceneTumor
 * ------------
 * What this file is:
 *   A React Three Fiber scene-graph component (NOT a standalone Canvas) that
 *   renders a living, timeline-reactive tumor model directly inside the existing
 *   anatomical body viewport.
 *
 * Its purpose (Seed and Soil context):
 *   This translates the abstract "Seed" — the primary cancer origin — into a
 *   visceral, physically-located 3D object. As the doctor scrubs the timeline
 *   month slider, the tumor expands (risk rising) or contracts (treatment working),
 *   letting the clinical team watch the Gompertz curve become spatial reality.
 *
 * Learning Points:
 *   - This is NOT a Canvas component — it must live inside an existing <Canvas>.
 *   - useLoader(OBJLoader) integrates with React Suspense; its parent must wrap
 *     this in <Suspense fallback={null}>.
 *   - Geometry mutation (addCancerLikeIrregularities) happens once inside useMemo.
 *     NEVER mutate BufferGeometry attributes inside useFrame — that runs at 60fps.
 *   - Per-frame reactivity (color, scale, glow) is cheap GPU work: we only update
 *     material uniforms and transform matrices, never geometry.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import type { TreatmentPresetId } from '@/lib/timeline';

/* ─── Visual constants ─────────────────────────────────────────────────── */

// Tumor color range: dormant dark crimson → aggressive bright red
const COLOR_DORMANT    = new THREE.Color(0x5a1030);
const COLOR_AGGRESSIVE = new THREE.Color(0xb70f41);

// Blood-cell satellite color (healthy erythrocyte pink)
const COLOR_SATELLITE = new THREE.Color(0xe8a080);

// World-unit diameter the tumor.obj is fitted to at scale=1
const TUMOR_FIT_SIZE = 0.6;

// World-unit diameter the blood-cell.obj is fitted to at scale=1
const CELL_FIT_SIZE = 0.12;

/* ─── Treatment aura definitions ───────────────────────────────────────── */

type TreatmentAura = {
  color: THREE.Color;
  pulseSpeed: number;
  intensity: number;
};

const TREATMENT_AURA: Record<TreatmentPresetId, TreatmentAura> = {
  CHEMOTHERAPY:     { color: new THREE.Color(0x00ddcc), pulseSpeed: 2.2, intensity: 1.4 },
  IMMUNOTHERAPY:    { color: new THREE.Color(0xffd700), pulseSpeed: 1.6, intensity: 1.0 },
  TARGETED_THERAPY: { color: new THREE.Color(0xa78bfa), pulseSpeed: 3.0, intensity: 1.6 },
  RADIATION:        { color: new THREE.Color(0xffffff), pulseSpeed: 4.0, intensity: 1.8 },
  OBSERVATION:      { color: new THREE.Color(0x334155), pulseSpeed: 0.8, intensity: 0.25 },
};

/* ─── Geometry utility (ported from ~/Documents/tumor/viewer.js) ────────
   Applies biologically-inspired surface irregularities to a geometry via
   normal-direction displacement. Called ONCE after OBJ load.
────────────────────────────────────────────────────────────────────────── */

function addCancerLikeIrregularities(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  if (!position) return;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const normal  = geometry.attributes.normal;
  const vertex  = new THREE.Vector3();
  const outward = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    outward.fromBufferAttribute(normal, i);

    // Guard: skip degenerate zero-length normals — normalize() on (0,0,0) = NaN
    if (outward.lengthSq() < 1e-6) continue;
    outward.normalize();

    // Multi-frequency wave displacement gives organic, irregular surface
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

/* ─── Helper: fit+center an OBJ clone to a target world-unit size ──────── */

function fitObjectToSize(object: THREE.Object3D, targetSize: number): number {
  // Manually iterate position attributes — never calls computeBoundingBox() so
  // Three.js never logs an error when geometry has NaN from degenerate faces.
  object.updateMatrixWorld(true);

  let minX = Infinity,  minY = Infinity,  minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let hasValid = false;

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      hasValid = true;
    }
  });

  if (!hasValid) return 1;

  const cx   = (minX + maxX) / 2;
  const cy   = (minY + maxY) / 2;
  const cz   = (minZ + maxZ) / 2;
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const size  = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ);
  if (size < 1e-6) return 1;

  const scale = targetSize / size;
  object.position.set(-cx * scale, -cy * scale, -cz * scale);
  object.scale.setScalar(scale);
  return scale;
}

/* ─── Satellite cancer blood cell ──────────────────────────────────────── */

interface SatelliteProps {
  cellObj: THREE.Object3D;
  index: number;
  total: number;
  risk: number;
}

function CancerBloodCell({ cellObj, index, total, risk }: SatelliteProps) {
  const groupRef = useRef<THREE.Group>(null!);

  // Unique, deterministic orbit parameters per satellite
  const { tiltX, radius, speed, phaseOffset } = useMemo(() => ({
    tiltX:       (index / Math.max(total, 1)) * Math.PI,
    radius:      0.28 + (index % 3) * 0.12,
    speed:       0.3  + index * 0.08,
    phaseOffset: (index / Math.max(total, 1)) * Math.PI * 2,
  }), [index, total]);

  // Process the shared cellObj clone once: apply irregularities + material
  const cellClone = useMemo(() => {
    const clone = cellObj.clone(true) as THREE.Group;
    clone.traverse((node) => {
      // Tag every node so CameraController excludes tumor geometry from organ zoom
      node.userData.isTumor = true;
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        // Disable frustum culling — renderer must not call computeBoundingSphere
        // on geometries that may have NaN positions from degenerate OBJ faces
        mesh.frustumCulled = false;
        addCancerLikeIrregularities(mesh.geometry);
        mesh.material = new THREE.MeshStandardMaterial({
          color: COLOR_SATELLITE,
          emissive: new THREE.Color(0x330000),
          emissiveIntensity: 0.3,
          roughness: 0.5,
          transparent: true,
          opacity: 0.9,
        });
      }
      // Lines in OBJ files also need frustumCulled disabled
      if ((node as THREE.Line).isLine) {
        (node as THREE.Line).frustumCulled = false;
      }
    });
    fitObjectToSize(clone, CELL_FIT_SIZE);
    return clone;
  }, [cellObj]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const angle = t * speed + phaseOffset;

    // Tilted elliptical orbit
    groupRef.current.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * tiltX) * radius * 0.3,
      Math.sin(angle) * radius,
    );

    // Fade in with risk — more cells appear as cancer progresses
    const mat = (cellClone.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.opacity = Math.min(0.9, risk * 1.2);
      const col = new THREE.Color().copy(COLOR_DORMANT).lerp(COLOR_AGGRESSIVE, risk * 0.6);
      mat.color.copy(col);
    }

    // Cell slowly rotates on its own axis
    groupRef.current.rotation.y += 0.008;
  });

  return (
    <group ref={groupRef}>
      <primitive object={cellClone} />
    </group>
  );
}

/* ─── Treatment aura point light ───────────────────────────────────────── */

function TreatmentAuraLight({ treatment, risk }: { treatment: TreatmentPresetId; risk: number }) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const aura = TREATMENT_AURA[treatment];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = Math.sin(t * aura.pulseSpeed) * 0.5 + 0.5;
    lightRef.current.intensity  = risk * aura.intensity * pulse * 3;
    lightRef.current.color.copy(aura.color);
  });

  return <pointLight ref={lightRef} position={[0, -0.3, 0]} distance={1.4} decay={2} intensity={0} />;
}

/* ─── Expanding growth ring (sonar ping effect) ─────────────────────────── */

function GrowthRing({ risk }: { risk: number }) {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    const frac = (t * 0.33) % 1; // complete cycle every 3s
    const baseRadius  = 0.1 + risk * 0.4;
    ringRef.current.scale.setScalar(1 + frac * 1.8);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = risk * 0.55 * (1 - frac);
  });

  const radius = 0.1 + risk * 0.4;
  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.012, 12, 64]} />
      <meshBasicMaterial color={COLOR_AGGRESSIVE} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

/* ─── Main tumor mass ───────────────────────────────────────────────────── */

interface TumorMassProps {
  tumorObj: THREE.Object3D;
  cellObj:  THREE.Object3D;
  risk: number;
  baselineRisk: number;
  treatment: TreatmentPresetId;
  month: number;
}

function TumorMass({ tumorObj, cellObj, risk, baselineRisk, treatment, month }: TumorMassProps) {
  const groupRef = useRef<THREE.Group>(null!);

  /* ── Process geometry ONCE at load time ─────────────────────────────── */
  const { tumorGroup, baseScale } = useMemo(() => {
    const clone = tumorObj.clone(true) as THREE.Group;

    clone.traverse((node) => {
      // Tag every node so CameraController excludes tumor geometry from organ zoom
      node.userData.isTumor = true;
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        // Disable frustum culling — renderer must not call computeBoundingSphere
        // on geometries that may have NaN positions from degenerate OBJ faces
        mesh.frustumCulled = false;
        addCancerLikeIrregularities(mesh.geometry);
        mesh.material = new THREE.MeshStandardMaterial({
          color:             COLOR_DORMANT.clone(),
          emissive:          new THREE.Color(0x2a0010),
          emissiveIntensity: 0.5,
          roughness:         0.65,
          metalness:         0.05,
          transparent:       true,
          opacity:           0.92,
          side:              THREE.DoubleSide,
        });
      }
      if ((node as THREE.Line).isLine) {
        (node as THREE.Line).frustumCulled = false;
        (node as THREE.Line).material = new THREE.LineBasicMaterial({
          color: 0xff88b0, transparent: true, opacity: 0.2,
        });
      }
    });

    const bs = fitObjectToSize(clone, TUMOR_FIT_SIZE);
    return { tumorGroup: clone, baseScale: bs };
  }, [tumorObj]);

  /* ── Reusable color scratch objects (avoids GC pressure) ────────────── */
  const _color    = useMemo(() => new THREE.Color(), []);
  const _emissive = useMemo(() => new THREE.Color(), []);

  /* ── Per-frame reactive animation ───────────────────────────────────── */
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Heartbeat-like pulse — more agitated at higher risk
    const pulse     = 1 + Math.sin(t * (2.2 + risk * 3)) * 0.018 * (0.5 + risk);
    // Risk-driven scale: 12% of full fit-size at risk=0, 100% at risk=1
    const riskScale = 0.12 + risk * 0.88;
    groupRef.current.scale.setScalar(riskScale * pulse);

    // Slow rotation — accelerates with risk
    groupRef.current.rotation.y += 0.003 + risk * 0.005;
    groupRef.current.rotation.x  = Math.sin(t * 0.2) * 0.04;

    // Update material on every mesh inside
    tumorGroup.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (!mat) return;

      // Color lerp: dormant dark → aggressive bright crimson
      _color.copy(COLOR_DORMANT).lerp(COLOR_AGGRESSIVE, risk);
      mat.color.copy(_color);

      // Emissive glow scales with risk
      _emissive.setHex(0x2a0010).lerp(new THREE.Color(0x8b0000), risk);
      mat.emissive.copy(_emissive);
      mat.emissiveIntensity = 0.25 + risk * 1.5;

      // Malignant gloss: surface smooths as cancer becomes more aggressive
      mat.roughness = 0.7 - risk * 0.3;
    });
  });

  /* ── Satellite cell count scales with risk ──────────────────────────── */
  const satelliteCount = Math.round(risk * 8);

  /* ── HUD callout ─────────────────────────────────────────────────────── */
  const deltaVsBase  = Math.round((risk - baselineRisk) * 100);
  const deltaStr     = `${deltaVsBase >= 0 ? '+' : ''}${deltaVsBase}%`;
  const deltaColor   = deltaVsBase > 0 ? '#fca5a5' : '#6ee7b7';
  const hudYOffset   = TUMOR_FIT_SIZE * (0.12 + risk * 0.88) + 0.22;

  return (
    <>
      {/* Tumor mass */}
      <group ref={groupRef}>
        <primitive object={tumorGroup} />
      </group>

      {/* Expanding growth ring */}
      <GrowthRing risk={risk} />

      {/* Treatment aura light */}
      <TreatmentAuraLight treatment={treatment} risk={risk} />

      {/* Satellite cancer blood cells */}
      {Array.from({ length: satelliteCount }, (_, i) => (
        <CancerBloodCell
          key={i}
          cellObj={cellObj}
          index={i}
          total={Math.max(satelliteCount, 1)}
          risk={risk}
        />
      ))}

      {/* In-scene floating HUD */}
      <Html position={[0, hudYOffset, 0]} center distanceFactor={4}>
        <div
          style={{
            fontFamily:      'ui-monospace, monospace',
            fontSize:        '9px',
            background:      'rgba(6,13,26,0.90)',
            border:          '1px solid rgba(183,15,65,0.5)',
            borderRadius:    '5px',
            padding:         '4px 8px',
            color:           'rgba(252,165,165,0.95)',
            whiteSpace:      'nowrap',
            pointerEvents:   'none',
            lineHeight:      '1.55',
            backdropFilter:  'blur(4px)',
            boxShadow:       '0 0 10px rgba(183,15,65,0.3)',
          }}
        >
          <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
            {month === 0 ? 'Dx' : `M${month}`} · {Math.round(risk * 100)}%
          </div>
          <div style={{ color: deltaColor, fontSize: '8px' }}>
            Δ {deltaStr} vs baseline
          </div>
        </div>
      </Html>
    </>
  );
}

/* ─── Public component interface ────────────────────────────────────────── */

export interface InSceneTumorProps {
  /** Current risk score at selectedMonth (0–1), drives scale + color */
  risk: number;
  /** Static baseline risk at month=0, used for delta callout */
  baselineRisk: number;
  /** Active treatment, drives the aura light color and pulse speed */
  treatment: TreatmentPresetId;
  /** Currently selected month from the timeline scrubber */
  month: number;
  /** 3D position in the anatomical body coordinate space */
  position: [number, number, number];
}

/**
 * InSceneTumor
 *
 * Must be rendered inside an existing <Canvas> (and inside <Suspense>).
 * Loads two OBJ models (tumor mass + cancerous blood cell), applies
 * cancer-like surface irregularities, and animates reactively based on
 * the timeline risk score and treatment preset.
 */
export function InSceneTumor({
  risk,
  baselineRisk,
  treatment,
  month,
  position,
}: InSceneTumorProps) {
  // Both models loaded once — useLoader is Suspense-compatible
  const tumorObj = useLoader(OBJLoader, '/models/tumor.obj');
  const cellObj  = useLoader(OBJLoader, '/models/cancerous-blood-cell.obj');

  return (
    <group position={new THREE.Vector3(...position)}>
      <TumorMass
        tumorObj={tumorObj}
        cellObj={cellObj}
        risk={risk}
        baselineRisk={baselineRisk}
        treatment={treatment}
        month={month}
      />
    </group>
  );
}
