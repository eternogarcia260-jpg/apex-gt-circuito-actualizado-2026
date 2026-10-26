import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function createFloodlightConcreteMaterial(base: THREE.Material): THREE.MeshStandardMaterial {
  const material = base.clone() as THREE.MeshStandardMaterial;
  material.name = 'C3_FloodlightFootingWeatheredConcrete';
  material.color.set(0xffffff);
  material.roughness = 0.96;
  material.metalness = 0;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return material;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const b = Math.sin(x * 0.071 + Math.sin(y * 0.053) * 2.1) * 6;
    const c = Math.sin(x * 0.31 + y * 0.19) * 3;
    const v = THREE.MathUtils.clamp(145 + (a - Math.floor(a) - 0.5) * 22 + b + c, 95, 190);
    image.data[i * 4] = v * 0.97;
    image.data[i * 4 + 1] = v * 0.98;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  material.map = map;
  material.needsUpdate = true;
  return material;
}

function createSteppedFlangeGeometry(): THREE.BufferGeometry {
  const parts = [
    new THREE.CylinderGeometry(0.43, 0.43, 0.09, 24, 1, false).translate(0, 0.205, 0),
    new THREE.CylinderGeometry(0.31, 0.31, 0.07, 24, 1, false).translate(0, 0.275, 0),
    new THREE.CylinderGeometry(0.218, 0.235, 0.10, 20, 1, false).translate(0, 0.34, 0),
  ];
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('No se pudo fusionar la brida del foco C3');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Circular stepped foundation and twelve anchor bolts, matching the supplied offline model. */
export function createC3FloodlightBases(poles: THREE.InstancedMesh, concreteMaterial: THREE.Material): THREE.Group {
  const bounds = new THREE.Box3().setFromBufferAttribute(poles.geometry.getAttribute('position') as THREE.BufferAttribute);
  const depth = 5.2;
  const group = new THREE.Group();
  group.name = 'C3_FloodlightFoundations';
  group.userData.c3NoShadow = true;
  const footingMaterial = createFloodlightConcreteMaterial(concreteMaterial);

  // The buried pier is preserved so waterfront masts still reach the seabed.
  const piers = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.40, 0.46, depth, 12, 1, false), footingMaterial, poles.count,
  );
  piers.name = 'C3_FloodlightDeepFoundations';
  const plinths = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.16, 24, 1, false), footingMaterial, poles.count,
  );
  plinths.name = 'C3_FloodlightConcreteBases';

  const plateMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_MachinedCircularAnchorFootplates', color: 0x606b72,
    metalness: 0.76, roughness: 0.43, clearcoat: 0.16, clearcoatRoughness: 0.45,
  });
  const plates = new THREE.InstancedMesh(createSteppedFlangeGeometry(), plateMaterial, poles.count);
  plates.name = 'C3_FloodlightSteelFootplates';

  const fastenerMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_StainlessAnchorFasteners', color: 0xabb3b7, metalness: 0.9, roughness: 0.29,
  });
  const bolts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.09, 6, 1, false), fastenerMaterial, poles.count * 12,
  );
  bolts.name = 'C3_FloodlightAnchorBolts';
  const washerMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_GalvanizedAnchorWashers', color: 0x929da2,
    metalness: 0.84, roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.52,
  });
  const washers = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.010, 10, 1, false), washerMaterial, poles.count * 12,
  );
  washers.name = 'C3_FloodlightAnchorWashers';

  const polePose = new THREE.Matrix4();
  const baseOffset = new THREE.Matrix4().makeTranslation(0, bounds.min.y, 0);
  const translation = new THREE.Matrix4();
  let boltIndex = 0;
  for (let i = 0; i < poles.count; i++) {
    poles.getMatrixAt(i, polePose);
    const basePose = polePose.clone().multiply(baseOffset);
    piers.setMatrixAt(i, basePose.clone().multiply(translation.makeTranslation(0, 0.15 - depth / 2, 0)));
    plinths.setMatrixAt(i, basePose.clone().multiply(translation.makeTranslation(0, 0.10, 0)));
    plates.setMatrixAt(i, basePose);
    for (let anchor = 0; anchor < 12; anchor++) {
      const angle = anchor * Math.PI * 2 / 12;
      const x = Math.cos(angle) * 0.35;
      const z = Math.sin(angle) * 0.35;
      bolts.setMatrixAt(boltIndex, basePose.clone().multiply(translation.makeTranslation(x, 0.245, z)));
      washers.setMatrixAt(boltIndex, basePose.clone().multiply(translation.makeTranslation(x, 0.294, z)));
      boltIndex++;
    }
  }
  for (const mesh of [piers, plinths, plates, washers, bolts]) {
    mesh.userData.c3NoShadow = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.c3MastCount = poles.count;
  group.userData.c3AnchorsPerMast = 12;
  return group;
}
