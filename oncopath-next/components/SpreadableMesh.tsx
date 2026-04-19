'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpreadableMeshProps extends Omit<React.ComponentProps<'mesh'>, 'geometry' | 'material'> {
  baseMesh: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    position?: THREE.Vector3 | [number, number, number];
    rotation?: THREE.Euler | [number, number, number];
    scale?: THREE.Vector3 | [number, number, number];
  };
  isSimulating: boolean;
}

export function SpreadableMesh({ baseMesh, isSimulating, ...props }: SpreadableMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create a ref object for our uniforms so we can update them inside useFrame without triggering re-renders
  const shaderUniforms = useRef({
      spreadOrigin: { value: new THREE.Vector3(0, 0, 0) },
      spreadRadius: { value: 0.0 },
      edgeWidth: { value: 0.2 } // soft transition width
  });

  const { clonedGeometry, originPoint } = useMemo(() => {
    const geo = baseMesh.geometry.clone();
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    
    // Choose the center of the mesh bounding box as the spread origin
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    // Optional: Add slight offset to make it look like it started from the side
    center.x += (bbox.max.x - bbox.min.x) * 0.2;
    center.y -= (bbox.max.y - bbox.min.y) * 0.1;

    return { clonedGeometry: geo, originPoint: center };
  }, [baseMesh.geometry]);

  const customMaterial = useMemo(() => {
    const mats = Array.isArray(baseMesh.material) ? baseMesh.material : [baseMesh.material];
    
    const clonedMats = mats.map(m => {
        const mat = m.clone();
        
        // This allows custom properties injected to be recognized
        mat.onBeforeCompile = (shader: any) => {
            // Bind our uniform references to the GPU shader object
            shader.uniforms.spreadOrigin = shaderUniforms.current.spreadOrigin;
            shader.uniforms.spreadRadius = shaderUniforms.current.spreadRadius;
            shader.uniforms.edgeWidth = shaderUniforms.current.edgeWidth;

            // --- VERTEX SHADER ---
            // Extract the true world position by multiplying modelMatrix with raw position
            shader.vertexShader = `
              varying vec3 vWorldPosition;
              ${shader.vertexShader}
            `.replace('void main() {', `
              void main() {
                // Determine absolute world position safely inside the vshader
                vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
            `);
            
            // --- FRAGMENT SHADER ---
            shader.fragmentShader = `
              uniform vec3 spreadOrigin;
              uniform float spreadRadius;
              uniform float edgeWidth;
              varying vec3 vWorldPosition;
              
              // Optional: Generic Pseudo-random noise function for organic edge artifacts
              float random(vec3 st) {
                  return fract(sin(dot(st.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453123);
              }
              
              ${shader.fragmentShader}
            `.replace('#include <color_fragment>', `
              #include <color_fragment>
              
              // Determine spatial distance from the simulation core
              float dist = distance(vWorldPosition, spreadOrigin);
              
              // Inject high frequency noise directly to the radius boundary so it spreads organically like cells rather than a perfect sphere
              float noiseOffset = (random(vWorldPosition * 10.0) - 0.5) * 0.15;
              
              // Calculate gradient smoothstep logic
              float currentEffectiveRadius = spreadRadius + noiseOffset;
              
              // t goes from 1.0 (inside infection radius) to 0.0 (outside)
              float t = 1.0 - smoothstep(currentEffectiveRadius - edgeWidth, currentEffectiveRadius, dist);
              
              // Apply physical necrosis darkening / pathogen pulsing visual.
              // When t is 1.0, pixel is completely replaced with black necrotic bounds.
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.01, 0.01), t);
            `);
        };
        mat.needsUpdate = true;
        return mat;
    });

    return Array.isArray(baseMesh.material) ? clonedMats : clonedMats[0];
  }, [baseMesh.material]);

  // Handle Simulation Start/Stop Triggers
  useEffect(() => {
     if (isSimulating) {
         shaderUniforms.current.spreadRadius.value = 0.0;
         
         // Update the origin relative to current mesh position logic
         if (meshRef.current) {
             const worldMatrix = meshRef.current.matrixWorld;
             const worldOrigin = originPoint.clone().applyMatrix4(worldMatrix);
             shaderUniforms.current.spreadOrigin.value.copy(worldOrigin);
         }
     } else {
         shaderUniforms.current.spreadRadius.value = 0.0;
     }
  }, [isSimulating, originPoint]);

  // Render Loop specific to Uniform adjustments
  useFrame((state, delta) => {
      if (!isSimulating || !meshRef.current) return;
      
      // Gradually increase radius over time allowing interpolation to engulf the tissue.
      shaderUniforms.current.spreadRadius.value += delta * 0.18; // Speed of spread
  });

  return (
    <mesh 
       ref={meshRef} 
       position={baseMesh.position}
       rotation={baseMesh.rotation}
       scale={baseMesh.scale}
       geometry={clonedGeometry} 
       material={customMaterial} 
       {...props} 
    />
  );
}
