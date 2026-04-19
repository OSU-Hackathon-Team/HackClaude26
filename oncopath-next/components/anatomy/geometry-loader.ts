import * as THREE from 'three';

export const ORGAN_GEOMETRIES = {
  liver: (() => {
    const geo = new THREE.SphereGeometry(1, 128, 128);
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
       let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
       if (x > 0) { x *= 1.8; y *= 1.3; } 
       else { y *= (1.0 + x*0.6); z *= (1.0 + x*0.5); }
       if (y < 0) { y *= 0.6; z += (y * 0.4); }
       if (z < 0) { z *= 0.6; }
       pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })(),

  kidney: (() => {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
       let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
       y *= 1.7; z *= 0.6; x *= 0.9;
       if (x < 0) { const pinch = Math.exp(-(y*y)*2); x += pinch * 0.9; }
       pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })(),

  brain: (() => {
    const geo = new THREE.SphereGeometry(1, 200, 200);
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
       let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
       y *= 0.85; z *= 1.15;
       const d = Math.sqrt(x*x + y*y + z*z);
       if(d > 0.01) {
           const theta = Math.asin(Math.max(-1, Math.min(1, y/d)));
           const phi = Math.atan2(z, x);
           let noise = Math.sin(phi * 25 + Math.sin(theta * 25)) * Math.cos(theta * 25 + Math.cos(phi * 25));
           noise += Math.sin(theta * 10) * Math.cos(phi * 10) * 0.5;
           const displacement = 1 + noise * 0.035;
           pos.setXYZ(i, x*displacement, y*displacement, z*displacement);
       }
    }
    geo.computeVertexNormals();
    return geo;
  })(),

  uterus: (() => {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
       let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
       z *= 0.5; x *= 0.9;
       if (y < 0) { x *= (1.0 + y*0.6); z *= (1.0 + y*0.6); } 
       else { x *= (1.0 + (y*y)*0.5); }
       pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })(),

  breast: (() => {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++){
       let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i);
       if (y > 0) { z *= (1.0 - y*0.6); } 
       else { z *= (1.0 + (-y)*0.3); } 
       x *= 0.95; 
       if (z < -0.2) z = -0.2; 
       pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  })()
};
