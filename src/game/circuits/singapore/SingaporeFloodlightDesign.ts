import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createC3FloodlightBases } from './SingaporeFloodlightBases';

type TrackPoint = { x: number; z: number; accumulatedDistance?: number };
type DetailLayer = 'housing' | 'metal' | 'optic' | 'lens';
type GeometryBuckets = Record<DetailLayer, THREE.BufferGeometry[]>;

const MAST_HEIGHT = 7.56;
const HEAD_OFFSET = 1.12;
const SPATIAL_STATIONS_PER_BATCH = 12;
const HEAD_PITCH = 0.06;

export function createC3FloodlightSteelMaterial(): THREE.MeshPhysicalMaterial {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = size;
  const albedoContext = albedoCanvas.getContext('2d', { willReadFrequently: true })!;
  const albedo = albedoContext.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    const grain = (hash - Math.floor(hash) - 0.5) * 11;
    const brush = Math.sin(x * 0.115 + Math.sin(y * 0.009) * 0.7) * 1.8;
    const pits = hash - Math.floor(hash) > 0.996 ? -15 : 0;
    const value = 154 + grain + brush + pits;
    albedo.data[index * 4] = value * 0.91;
    albedo.data[index * 4 + 1] = value * 0.98;
    albedo.data[index * 4 + 2] = value * 1.02;
    albedo.data[index * 4 + 3] = 255;
    height[index] = grain * 0.14 + brush * 0.20 + pits * 0.12;
  }
  albedoContext.putImageData(albedo, 0, 0);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = size;
  const normalContext = normalCanvas.getContext('2d', { willReadFrequently: true })!;
  const normal = normalContext.createImageData(size, size);
  const heightAt = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    normal.data[i] = THREE.MathUtils.clamp(128 - (heightAt(x + 1, y) - heightAt(x - 1, y)) * 5, 0, 255);
    normal.data[i + 1] = THREE.MathUtils.clamp(128 - (heightAt(x, y + 1) - heightAt(x, y - 1)) * 5, 0, 255);
    normal.data[i + 2] = 254;
    normal.data[i + 3] = 255;
  }
  normalContext.putImageData(normal, 0, 0);

  const roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = roughnessCanvas.height = size;
  const roughnessContext = roughnessCanvas.getContext('2d', { willReadFrequently: true })!;
  const roughness = roughnessContext.createImageData(size, size);
  for (let index = 0; index < size * size; index++) {
    const value = THREE.MathUtils.clamp(195 + height[index] * 7, 0, 255);
    const i = index * 4;
    roughness.data[i] = roughness.data[i + 1] = roughness.data[i + 2] = value;
    roughness.data[i + 3] = 255;
  }
  roughnessContext.putImageData(roughness, 0, 0);

  const texture = (canvas: HTMLCanvasElement, colorSpace?: THREE.ColorSpace) => {
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1.5, 1.0);
    map.anisotropy = 8;
    if (colorSpace) map.colorSpace = colorSpace;
    return map;
  };
  return new THREE.MeshPhysicalMaterial({
    name: 'C3_WeatherproofPowderCoatedGalvanizedSteel',
    color: 0xb9c0c5,
    map: texture(albedoCanvas, THREE.SRGBColorSpace),
    normalMap: texture(normalCanvas),
    roughnessMap: texture(roughnessCanvas),
    normalScale: new THREE.Vector2(0.17, 0.17),
    roughness: 0.58,
    metalness: 0.36,
    clearcoat: 0.12,
    clearcoatRoughness: 0.52,
  });
}

function localTransform(
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rotation?: THREE.Quaternion,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    rotation ?? new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
}

function pushTransformed(buckets: GeometryBuckets, layer: DetailLayer, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
  geometry.applyMatrix4(matrix);
  buckets[layer].push(geometry);
}

function addBox(buckets: GeometryBuckets, layer: DetailLayer, size: [number, number, number], position: [number, number, number]): void {
  pushTransformed(buckets, layer, new THREE.BoxGeometry(...size), localTransform(...position));
}

function addCylinder(
  buckets: GeometryBuckets,
  layer: DetailLayer,
  radiusTop: number,
  radiusBottom: number,
  depth: number,
  segments: number,
  position: [number, number, number],
): void {
  const faceForward = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  pushTransformed(
    buckets,
    layer,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, depth, segments, 1, false),
    localTransform(...position, 1, 1, 1, faceForward),
  );
}

function addBeam(
  buckets: GeometryBuckets,
  layer: DetailLayer,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments = 12,
): void {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (length < 1e-5) return;
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  const center = start.clone().add(end).multiplyScalar(0.5);
  pushTransformed(
    buckets,
    layer,
    new THREE.CylinderGeometry(radius * 0.88, radius, 1, segments, 1, false),
    new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(1, length, 1)),
  );
}

function mergeLayer(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('No se pudo fusionar la geometría de las luminarias C3');
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Builds one low-draw-call head template from the supplied six-module, 18-optic design. */
function createHeadTemplates(): Record<DetailLayer, THREE.BufferGeometry> {
  const buckets: GeometryBuckets = { housing: [], metal: [], optic: [], lens: [] };

  // Central rear truss and the machined support rails from the reference design.
  addBox(buckets, 'housing', [2.72, 0.12, 0.24], [0, 0, -0.045]);
  addBox(buckets, 'metal', [2.66, 0.035, 0.025], [0, 0, 0.095]);
  for (const x of [-1.27, 1.27]) {
    addBox(buckets, 'housing', [0.10, 0.96, 0.25], [x, 0, -0.02]);
    addBox(buckets, 'metal', [0.055, 0.84, 0.035], [x, 0, 0.115]);
  }

  const xPositions = [-0.82, 0, 0.82];
  const yPositions = [-0.25, 0.25];
  for (const cy of yPositions) for (const cx of xPositions) {
    // Six sealed die-cast housings, stepped optical face, gasket and glass cover.
    addBox(buckets, 'housing', [0.765, 0.435, 0.30], [cx, cy, 0.205]);
    addBox(buckets, 'housing', [0.713, 0.397, 0.065], [cx, cy, 0.365]);
    addBox(buckets, 'metal', [0.691, 0.026, 0.025], [cx, cy - 0.184, 0.421]);
    addBox(buckets, 'metal', [0.691, 0.026, 0.025], [cx, cy + 0.184, 0.421]);
    addBox(buckets, 'metal', [0.026, 0.345, 0.025], [cx - 0.333, cy, 0.421]);
    addBox(buckets, 'metal', [0.026, 0.345, 0.025], [cx + 0.333, cy, 0.421]);
    addBox(buckets, 'optic', [0.611, 0.296, 0.010], [cx, cy, 0.424]);
    addBox(buckets, 'lens', [0.584, 0.270, 0.009], [cx, cy, 0.429]);

    // The 18 individual reflectors per module remain real, but share only four merged geometries.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const x = cx + (col - 2.5) * 0.091;
      const y = cy + (row - 1) * 0.087;
      // One eight-sided reflector cup and a low-poly convex lens avoid hundreds
      // of tiny ring triangles per mast while preserving the reference's dense array.
      addCylinder(buckets, 'optic', 0.031, 0.027, 0.013, 8, [x, y, 0.437]);
      const lens = new THREE.SphereGeometry(0.010, 6, 3);
      pushTransformed(buckets, 'lens', lens, localTransform(x, y, 0.449));
    }

    // Fine corner fasteners and five low-profile rear cooling fins per module.
    for (const dx of [-0.30, 0.30]) for (const dy of [-0.15, 0.15]) {
      addCylinder(buckets, 'metal', 0.014, 0.014, 0.016, 8, [cx + dx, cy + dy, 0.429]);
    }
    for (let fin = 0; fin < 5; fin++) {
      addBox(buckets, fin % 2 ? 'housing' : 'metal', [0.59, 0.021, 0.045], [cx, cy + (fin - 2) * 0.064, 0.035]);
    }
  }

  // Paired circular side trunnions and fork uprights match the reference's adjustable yoke.
  for (const side of [-1, 1]) {
    const x = side * 1.38;
    addBeam(buckets, 'housing', new THREE.Vector3(x - side * 0.10, 0, -0.04), new THREE.Vector3(x + side * 0.10, 0, -0.04), 0.155, 12);
    addBeam(buckets, 'metal', new THREE.Vector3(x - side * 0.12, 0, -0.04), new THREE.Vector3(x + side * 0.12, 0, -0.04), 0.103, 12);
    addBeam(buckets, 'metal', new THREE.Vector3(side * 1.32, -0.38, -0.08), new THREE.Vector3(side * 1.32, 0.40, -0.08), 0.035, 8);
  }

  // Short outer caps visually finish the six-module matrix.
  for (const x of [-1.31, 1.31]) {
    addBox(buckets, 'metal', [0.12, 1.05, 0.45], [x, 0, 0.17]);
    addBox(buckets, 'housing', [0.08, 0.94, 0.035], [x, 0, 0.408]);
  }

  return {
    housing: mergeLayer(buckets.housing),
    metal: mergeLayer(buckets.metal),
    optic: mergeLayer(buckets.optic),
    lens: mergeLayer(buckets.lens),
  };
}

/** Shared maintenance ladder: no individual runtime mesh for its rails or rungs. */
function createMastAccessTemplate(): THREE.BufferGeometry {
  const buckets: GeometryBuckets = { housing: [], metal: [], optic: [], lens: [] };
  for (const x of [-0.235, 0.235]) {
    addBeam(buckets, 'metal', new THREE.Vector3(x, 0.57 - MAST_HEIGHT / 2, -0.12), new THREE.Vector3(x * 0.72, 6.55 - MAST_HEIGHT / 2, -0.16), 0.020, 8);
  }
  for (let y = 0.72; y < 6.52; y += 0.32) {
    const t = y / 6.55;
    const half = 0.235 * (1 - t) + 0.169 * t;
    addBeam(buckets, 'metal', new THREE.Vector3(-half, y - MAST_HEIGHT / 2, -0.165), new THREE.Vector3(half, y - MAST_HEIGHT / 2, -0.165), 0.016, 6);
  }
  return mergeLayer(buckets.metal);
}

function addInstances(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly THREE.Matrix4[],
): THREE.InstancedMesh | undefined {
  if (!transforms.length) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.userData.c3NoShadow = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

interface FloodlightBatch {
  poleTransforms: THREE.Matrix4[];
  conduitTransforms: THREE.Matrix4[];
  collarTransforms: THREE.Matrix4[];
  cabinetTransforms: THREE.Matrix4[];
  cabinetDoorTransforms: THREE.Matrix4[];
  cabinetHandleTransforms: THREE.Matrix4[];
  headTransforms: THREE.Matrix4[];
  supportTransforms: THREE.Matrix4[];
}

/** Repeated 7.56m floodlight towers, with the supplied six-module head aimed at the racing surface. */
export function buildC3FloodlightRig(
  points: readonly TrackPoint[],
  halfWidth: number,
  poleMaterial: THREE.MeshStandardMaterial,
  concreteMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'C3_HighMastStadiumFloodlights';
  const batches = new Map<number, FloodlightBatch>();
  const headFrames = new THREE.Object3D();
  const poleFrame = new THREE.Object3D();
  const headPitch = new THREE.Matrix4().makeRotationX(HEAD_PITCH);
  const forward = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  let fixtureCount = 0;
  let minimumAimDot = 1;

  for (let i = 0; i < points.length; i += 6) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    const prev = points[(i - 1 + points.length) % points.length];
    if (!p || !next || !prev || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const tangentLength = Math.hypot(dx, dz);
    if (!(tangentLength > 1e-6)) continue;
    const tangentX = dx / tangentLength;
    const tangentZ = dz / tangentLength;
    const normalX = -tangentZ;
    const normalZ = tangentX;
    const distance = p.accumulatedDistance ?? ((i / points.length) * 4927);
    const stationBatch = Math.floor((i / 6) / SPATIAL_STATIONS_PER_BATCH);

    for (const side of [-1, 1]) {
      // Keep both pit entry/exit and the curved pit-lane frontage clear.
      if (side === 1 && (distance >= 4600 || distance <= 260)) continue;
      const mastX = p.x + normalX * (halfWidth + 4.2) * side;
      const mastZ = p.z + normalZ * (halfWidth + 4.2) * side;
      const targetX = p.x + tangentX * 13;
      const targetZ = p.z + tangentZ * 13;
      const aimX = targetX - mastX;
      const aimZ = targetZ - mastZ;
      const horizontalLength = Math.hypot(aimX, aimZ) || 1;
      const dirX = aimX / horizontalLength;
      const dirZ = aimZ / horizontalLength;

      let batch = batches.get(stationBatch);
      if (!batch) {
        batch = {
          poleTransforms: [], conduitTransforms: [], collarTransforms: [],
          cabinetTransforms: [], cabinetDoorTransforms: [], cabinetHandleTransforms: [], headTransforms: [], supportTransforms: [],
        };
        batches.set(stationBatch, batch);
      }

      // Local +Z follows the track-facing side, making the service box and cable orientation consistent.
      poleFrame.position.set(mastX, MAST_HEIGHT / 2, mastZ);
      poleFrame.rotation.set(0, Math.atan2(dirX, dirZ), 0);
      poleFrame.scale.set(1, 1, 1);
      poleFrame.updateMatrix();
      const poleMatrix = poleFrame.matrix.clone();
      batch.poleTransforms.push(poleMatrix);

      for (const y of [0.72, 1.28, 3.30, 5.48, 6.77]) {
        const radius = 0.205 - (y / MAST_HEIGHT) * (0.205 - 0.108);
        const ringRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        const ringScale = radius / 0.2;
        batch.collarTransforms.push(poleMatrix.clone().multiply(localTransform(0, y - MAST_HEIGHT / 2, 0, ringScale, ringScale, 1, ringRotation)));
      }
      for (const y of [0.82, 2.35, 3.88, 5.41, 6.84]) {
        batch.conduitTransforms.push(poleMatrix.clone().multiply(localTransform(0.157, y - MAST_HEIGHT / 2, 0.115, 1, 1.45, 1)));
      }
      batch.cabinetTransforms.push(poleMatrix.clone().multiply(localTransform(0, 0.99 - MAST_HEIGHT / 2, 0.205)));
      batch.cabinetDoorTransforms.push(poleMatrix.clone().multiply(localTransform(0, 0.99 - MAST_HEIGHT / 2, 0.273, 0.285, 0.36, 0.016)));
      batch.cabinetHandleTransforms.push(poleMatrix.clone().multiply(localTransform(-0.105, 0.99 - MAST_HEIGHT / 2, 0.284, 0.012, 0.085, 0.018)));

      const headX = mastX + dirX * HEAD_OFFSET;
      const headZ = mastZ + dirZ * HEAD_OFFSET;
      headFrames.position.set(headX, MAST_HEIGHT, headZ);
      headFrames.lookAt(targetX, 0.2, targetZ);
      headFrames.scale.set(1, 1, 1);
      headFrames.updateMatrix();
      const headMatrix = headFrames.matrix.clone().multiply(headPitch);
      batch.headTransforms.push(headMatrix);

      // Unlike the optical frame, these braces are built between the actual
      // pole and head attachment points, so downward aiming cannot detach the yoke.
      for (const lateral of [0, -1.05, 1.05]) {
        const start = new THREE.Vector3(mastX, MAST_HEIGHT - (lateral === 0 ? 0.12 : 0.48), mastZ);
        const end = new THREE.Vector3(lateral, -0.10, -0.08).applyMatrix4(headMatrix);
        const axis = end.clone().sub(start);
        const length = axis.length();
        const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
        const center = start.add(end).multiplyScalar(0.5);
        const radius = lateral === 0 ? 0.052 : 0.026;
        batch.supportTransforms.push(new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(radius, length, radius)));
      }

      forward.set(0, 0, 1).transformDirection(headMatrix);
      toTarget.set(targetX - headX, 0.2 - MAST_HEIGHT, targetZ - headZ).normalize();
      minimumAimDot = Math.min(minimumAimDot, forward.dot(toTarget));
      fixtureCount++;
    }
  }

  const housingMaterial = poleMaterial.clone() as THREE.MeshPhysicalMaterial;
  housingMaterial.name = 'C3_SixModuleGraphiteDieCastHousing';
  housingMaterial.color.set(0x606b72);
  housingMaterial.metalness = 0.08;
  housingMaterial.roughness = 0.42;
  housingMaterial.clearcoat = 0.38;
  housingMaterial.clearcoatRoughness = 0.25;
  housingMaterial.normalScale.set(0.08, 0.08);

  const detailMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_MachinedFloodlightFramesAndHeatSinks', color: 0x87939a,
    metalness: 0.76, roughness: 0.36, clearcoat: 0.24, clearcoatRoughness: 0.32,
  });
  const opticMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_IndividualMetalizedOpticReflectors', color: 0x6d777c,
    metalness: 0.78, roughness: 0.27, clearcoat: 0.22, clearcoatRoughness: 0.24,
    side: THREE.DoubleSide,
  });
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_SealedUnlitConvexOpticLenses', color: 0x9eaaae,
    metalness: 0.02, roughness: 0.19, clearcoat: 0.88, clearcoatRoughness: 0.07,
  });
  const conduitMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_WeatherSealedPowerRaceway', color: 0x343c40, metalness: 0.62, roughness: 0.48,
    clearcoat: 0.12, clearcoatRoughness: 0.5,
  });
  const collarMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_ClampedMastCollars', color: 0x68737a, metalness: 0.78, roughness: 0.39,
    clearcoat: 0.18, clearcoatRoughness: 0.46,
  });
  const cabinetMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_WeatherproofMastElectricalEnclosures', color: 0x30383d,
    metalness: 0.42, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.45,
  });
  const cabinetDoorMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_EnamelledElectricalAccessDoors', color: 0x48535a,
    metalness: 0.58, roughness: 0.42, clearcoat: 0.16, clearcoatRoughness: 0.4,
  });
  const latchMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_EnclosureSteelLatches', color: 0xaab3b7, metalness: 0.9, roughness: 0.27,
  });
  const mastGeometry = new THREE.CylinderGeometry(0.108, 0.205, MAST_HEIGHT, 20, 6, false);
  const conduitGeometry = new THREE.CylinderGeometry(0.026, 0.026, 1, 10, 1, false);
  const collarGeometry = new THREE.TorusGeometry(0.2, 0.018, 6, 20);
  const cabinetGeometry = new THREE.BoxGeometry(0.33, 0.43, 0.12);
  const doorGeometry = new THREE.BoxGeometry(1, 1, 1);
  const handleGeometry = new THREE.BoxGeometry(1, 1, 1);
  const headTemplates = createHeadTemplates();
  const mastAccessGeometry = createMastAccessTemplate();
  const supportGeometry = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
  const batchCount = batches.size;
  const foundationPoles = new THREE.InstancedMesh(mastGeometry, poleMaterial, fixtureCount);
  foundationPoles.name = 'C3_FloodlightMasts';
  foundationPoles.userData.c3NoShadow = true;
  foundationPoles.castShadow = false;
  foundationPoles.receiveShadow = false;

  const foundationMatrices: THREE.Matrix4[] = [];
  let foundationIndex = 0;
  const batchEntries = [...batches.entries()].sort((a, b) => a[0] - b[0]);
  for (const [batchIndex, batch] of batchEntries) {
    addInstances(group, `C3_FloodlightMasts_B${String(batchIndex).padStart(2, '0')}`, mastGeometry, poleMaterial, batch.poleTransforms);
    addInstances(group, `C3_FloodlightYokeSupports_B${String(batchIndex).padStart(2, '0')}`, supportGeometry, detailMaterial, batch.supportTransforms);
    addInstances(group, `C3_FloodlightMaintenanceLadders_B${String(batchIndex).padStart(2, '0')}`, mastAccessGeometry, detailMaterial, batch.poleTransforms);
    addInstances(group, `C3_FloodlightServiceConduits_B${String(batchIndex).padStart(2, '0')}`, conduitGeometry, conduitMaterial, batch.conduitTransforms);
    addInstances(group, `C3_FloodlightMastCollars_B${String(batchIndex).padStart(2, '0')}`, collarGeometry, collarMaterial, batch.collarTransforms);
    addInstances(group, `C3_FloodlightServiceCabinets_B${String(batchIndex).padStart(2, '0')}`, cabinetGeometry, cabinetMaterial, batch.cabinetTransforms);
    addInstances(group, `C3_FloodlightCabinetDoors_B${String(batchIndex).padStart(2, '0')}`, doorGeometry, cabinetDoorMaterial,
      batch.cabinetDoorTransforms.map(matrix => matrix.clone().multiply(localTransform(0, 0, 0.5))));
    addInstances(group, `C3_FloodlightCabinetLatches_B${String(batchIndex).padStart(2, '0')}`, handleGeometry, latchMaterial, batch.cabinetHandleTransforms);

    addInstances(group, `C3_SixModuleFloodlightHousing_B${String(batchIndex).padStart(2, '0')}`, headTemplates.housing, housingMaterial, batch.headTransforms);
    addInstances(group, `C3_SixModuleFloodlightMachinedDetails_B${String(batchIndex).padStart(2, '0')}`, headTemplates.metal, detailMaterial, batch.headTransforms);
    addInstances(group, `C3_SixModuleFloodlightReflectors_B${String(batchIndex).padStart(2, '0')}`, headTemplates.optic, opticMaterial, batch.headTransforms);
    addInstances(group, `C3_SixModuleFloodlightLenses_B${String(batchIndex).padStart(2, '0')}`, headTemplates.lens, lensMaterial, batch.headTransforms);

    for (const matrix of batch.poleTransforms) foundationMatrices.push(matrix);
  }
  // The foundation helper uses the pole transforms for its four instanced footing details.
  for (const matrix of foundationMatrices) foundationPoles.setMatrixAt(foundationIndex++, matrix);
  foundationPoles.instanceMatrix.needsUpdate = true;
  foundationPoles.computeBoundingBox();
  foundationPoles.computeBoundingSphere();
  const foundations = createC3FloodlightBases(foundationPoles, concreteMaterial);
  foundationPoles.dispose();
  group.add(foundations);

  group.userData.c3FloodlightDesign = {
    fixtureCount,
    modulesPerFixture: 6,
    opticsPerModule: 18,
    sealedOpticCount: fixtureCount * 6 * 18,
    mastHeight: MAST_HEIGHT,
    spatialBatches: batchCount,
    drawMeshesPerBatch: 12,
    supportBeamCount: fixtureCount * 3,
    minimumOpticAimDot: minimumAimDot,
    direction: 'six two-row modules on every mast, all faces aimed at the racing surface',
    mounting: 'fixed top yoke, downward optical pitch, weatherproof conduit and service cabinet',
    optimization: 'four merged head geometries, shared InstancedMesh buffers and 12-station frustum-cull batches; no per-head dynamic lights',
    dynamicLightCount: 0,
    sourceDesign: 'Foco_Circuito_Offline.html',
  };
  return group;
}
