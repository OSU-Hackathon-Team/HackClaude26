'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

interface TumorMicroSceneProps {
  risk: number | null;
  selectedMonth: number;
  organLabel: string;
  treatmentLabel: string;
}

interface PreparedObject {
  object: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

function clampRisk(value: number | null): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value as number, 0), 1);
}

function prepareObject({
  source,
  targetSize,
  color,
  emissive,
  metalness,
  roughness,
}: {
  source: THREE.Group;
  targetSize: number;
  color: string;
  emissive: string;
  metalness: number;
  roughness: number;
}): PreparedObject {
  const object = source.clone(true);
  const materials: THREE.MeshStandardMaterial[] = [];

  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.2,
      roughness,
      metalness,
    });
    node.material = material;
    node.castShadow = true;
    node.receiveShadow = true;
    materials.push(material);
  });

  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = targetSize / maxDim;
    object.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(object);
    const center = scaledBox.getCenter(new THREE.Vector3());
    object.position.sub(center);
  }

  return { object, materials };
}

function TumorMicroModel({ risk, selectedMonth }: { risk: number; selectedMonth: number }) {
  const tumorRaw = useLoader(OBJLoader, '/models/tumor.obj');
  const bloodCellRaw = useLoader(OBJLoader, '/models/cancerous-blood-cell.obj');
  const tumorGroupRef = useRef<THREE.Group | null>(null);
  const bloodCellGroupRefs = useRef<Array<THREE.Group | null>>([]);

  const tumor = useMemo(
    () =>
      prepareObject({
        source: tumorRaw,
        targetSize: 2.4,
        color: '#be123c',
        emissive: '#fb7185',
        metalness: 0.15,
        roughness: 0.45,
      }),
    [tumorRaw]
  );

  const bloodCellTemplate = useMemo(
    () =>
      prepareObject({
        source: bloodCellRaw,
        targetSize: 0.85,
        color: '#fb923c',
        emissive: '#f97316',
        metalness: 0.1,
        roughness: 0.3,
      }),
    [bloodCellRaw]
  );

  const bloodCells = useMemo(
    () =>
      Array.from({ length: 11 }, (_, index) => {
        const clone = bloodCellTemplate.object.clone(true);
        const materials: THREE.MeshStandardMaterial[] = [];
        clone.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) {
            return;
          }
          const material = (node.material as THREE.MeshStandardMaterial).clone();
          node.material = material;
          materials.push(material);
        });
        return {
          object: clone,
          phase: index * 0.55,
          baseRadius: 2 + (index % 4) * 0.35,
          baseHeight: ((index % 5) - 2) * 0.35,
          materials,
        };
      }),
    [bloodCellTemplate.object]
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const motionSpeed = 0.45 + risk * 2.05;
    const turbulence = 0.15 + risk * 1.9;
    const monthInfluence = 1 + Math.min(Math.max(selectedMonth, 0), 24) / 300;

    if (tumorGroupRef.current) {
      const pulse = 1 + Math.sin(elapsed * (1 + risk * 1.5)) * (0.025 + risk * 0.03);
      const targetScale = (0.75 + risk * 1.35) * monthInfluence * pulse;
      tumorGroupRef.current.scale.setScalar(targetScale);
      tumorGroupRef.current.rotation.y = elapsed * 0.1;
    }

    const tumorGlow = Math.max(0.05, 0.12 + risk * 1.1 + Math.sin(elapsed * 2.2) * 0.08);
    tumor.materials.forEach((material) => {
      material.emissiveIntensity = tumorGlow;
    });

    bloodCells.forEach((cell, index) => {
      const host = bloodCellGroupRefs.current[index];
      if (!host) {
        return;
      }

      const angular = elapsed * motionSpeed + cell.phase;
      const radialNudge = Math.sin(elapsed * 1.7 + cell.phase) * 0.3 * turbulence;
      const verticalNudge = Math.cos(elapsed * 2.1 + cell.phase) * 0.45 * turbulence;
      const radius = cell.baseRadius + radialNudge;

      host.position.set(Math.cos(angular) * radius, cell.baseHeight + verticalNudge, Math.sin(angular) * radius);
      host.rotation.set(angular * 0.6, angular * 0.9, angular * 0.3);

      const glow = Math.max(0.04, 0.08 + risk * 1.2 + Math.sin(elapsed * 3 + cell.phase) * 0.06);
      cell.materials.forEach((material) => {
        material.emissiveIntensity = glow;
      });
    });
  });

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 8, 6]} intensity={1.5} castShadow />
      <pointLight position={[-4, 1.5, 2]} color="#fb7185" intensity={2.3} />
      <pointLight position={[4, -1, -2]} color="#fb923c" intensity={1.1} />

      <group ref={tumorGroupRef}>
        <primitive object={tumor.object} />
      </group>

      {bloodCells.map((cell, index) => (
        <group
          key={index}
          ref={(node) => {
            bloodCellGroupRefs.current[index] = node;
          }}
        >
          <primitive object={cell.object} />
        </group>
      ))}

      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0.05} />
      </mesh>
    </>
  );
}

export function TumorMicroScene({ risk, selectedMonth, organLabel, treatmentLabel }: TumorMicroSceneProps) {
  const safeRisk = clampRisk(risk);
  const riskPercent = Math.round(safeRisk * 100);

  return (
    <div className="relative w-full h-full" data-testid="tumor-micro-scene">
      <Canvas shadows dpr={[1, 1.75]}>
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 8, 22]} />
        <PerspectiveCamera makeDefault position={[0, 1.9, 8.2]} fov={44} />
        <TumorMicroModel risk={safeRisk} selectedMonth={selectedMonth} />
        <OrbitControls enablePan={false} minDistance={4.2} maxDistance={12} maxPolarAngle={Math.PI * 0.82} />
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg border border-zinc-700/70 bg-zinc-950/75 px-4 py-2 text-center backdrop-blur-sm">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Micro view context</p>
        <p className="text-xs text-zinc-100">
          {organLabel} · Month {selectedMonth} · Risk {riskPercent}% · {treatmentLabel}
        </p>
      </div>
    </div>
  );
}
