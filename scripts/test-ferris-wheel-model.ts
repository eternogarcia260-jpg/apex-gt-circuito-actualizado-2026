import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SingaporeFerrisWheel } from '../src/game/circuits/singapore/SingaporeFerrisWheel.ts';
import { C3_FERRIS_WHEEL_PLACEMENT, C3_FERRIS_WHEEL_SCALE } from '../src/game/circuits/singapore/SingaporeFerrisWheelLayout.ts';

function exactVertexBounds(root: THREE.Object3D): THREE.Box3 {
  const result = new THREE.Box3(), vertex = new THREE.Vector3(), instance = new THREE.Matrix4(), world = new THREE.Matrix4();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const count = object instanceof THREE.InstancedMesh ? object.count : object instanceof THREE.BatchedMesh ? object.instanceCount : 1;
    for (let i = 0; i < count; i++) {
      if (object instanceof THREE.InstancedMesh || object instanceof THREE.BatchedMesh) {
        object.getMatrixAt(i, instance); world.multiplyMatrices(object.matrixWorld, instance);
      } else world.copy(object.matrixWorld);
      for (let j = 0; j < position.count; j++) result.expandByPoint(vertex.fromBufferAttribute(position, j).applyMatrix4(world));
    }
  });
  return result;
}

assert.throws(() => new SingaporeFerrisWheel(NaN), RangeError);
assert.throws(() => new SingaporeFerrisWheel(Infinity), RangeError);
const wheel = new SingaporeFerrisWheel(-1.25);
assert.equal(wheel.root.name, 'C3_FerrisWheel');
assert.deepEqual(wheel.root.position.toArray(), [-100, 0, -40]);
assert.deepEqual(wheel.root.scale.toArray(), [2, 2, 2]);
assert.equal(wheel.diagnostics.appliedScale, C3_FERRIS_WHEEL_SCALE);
assert.equal(wheel.diagnostics.cabins, 32);
assert.equal(wheel.diagnostics.radius, 28.7);
assert.equal(wheel.diagnostics.angularSpeed, 0.035);
const pivot = wheel.root.getObjectByName('C3_FerrisWheelSpinPivot')!;
const rotor = wheel.root.getObjectByName('C3_FerrisWheelRotor')!;
assert.ok(pivot && rotor);
const meshes: THREE.Mesh[] = [], cabinMeshes: (THREE.InstancedMesh | THREE.BatchedMesh)[] = [];
wheel.root.traverse(o => {
  assert.equal(o instanceof THREE.Light, false, 'the component must not add lights');
  if (o instanceof THREE.Mesh) {
    meshes.push(o);
    assert.equal(o.layers.isEnabled(0), true); assert.equal(o.layers.isEnabled(1), true);
    assert.equal(o.userData.c3NoShadow, !o.castShadow);
    assert.equal(o.matrixWorldAutoUpdate, true, 'moving-parent world transforms remain live');
    if (o.name.startsWith('C3_FerrisWheelCabins_')) cabinMeshes.push(o as THREE.InstancedMesh | THREE.BatchedMesh);
  }
});
assert.ok(cabinMeshes.length > 1);
assert.equal(cabinMeshes.filter(o => o instanceof THREE.BatchedMesh).length, 1);
const glassBatch = cabinMeshes.find(o => o instanceof THREE.BatchedMesh) as THREE.BatchedMesh;
assert.equal(glassBatch.instanceCount, 32);
assert.equal(glassBatch.sortObjects, true); assert.equal(glassBatch.perObjectFrustumCulled, true);
const glass = glassBatch.material as THREE.MeshPhysicalMaterial;
assert.equal(glass.opacity, 0.46); assert.equal(glass.metalness, 0.52); assert.equal(glass.clearcoat, 1);
const glassPositions = glassBatch.geometry.getAttribute('position');
let glassMinY = Infinity, glassMaxY = -Infinity;
for (let i = 0; i < glassPositions.count; i++) { glassMinY = Math.min(glassMinY, glassPositions.getY(i)); glassMaxY = Math.max(glassMaxY, glassPositions.getY(i)); }
assert.ok(glassMinY < -3 && glassMaxY < -1.5, 'the cabin child offset -3.28 must be baked through its complete hierarchy');
const rotorLocal = new THREE.Box3();
rotor.traverse(o => { if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) { o.geometry.computeBoundingBox(); rotorLocal.union(o.geometry.boundingBox!); } });
assert.ok(rotorLocal.min.x < -29 && rotorLocal.max.x > 29);
assert.ok(rotorLocal.max.y > 64 && rotorLocal.min.z > -5.1 && rotorLocal.max.z < 5.1, 'original torus rings remain vertical in XY, not horizontal in XZ');
const rotorMesh = rotor.children.find(o => o instanceof THREE.Mesh) as THREE.Mesh;
wheel.root.updateMatrixWorld(true); const initialMatrix = rotorMesh.matrixWorld.clone();
wheel.setTime(10); wheel.root.updateMatrixWorld(true);
assert.ok(Math.abs(pivot.rotation.z - 0.35) < 1e-12); assert.equal(pivot.rotation.y, 0);
assert.notDeepEqual(rotorMesh.matrixWorld.elements, initialMatrix.elements, 'the rotor follows its moving axle');
const matrix = new THREE.Matrix4();
for (const batch of cabinMeshes) {
  const count = batch instanceof THREE.BatchedMesh ? batch.instanceCount : batch.count;
  assert.equal(count, 32);
  for (let i = 0; i < count; i++) {
    batch.getMatrixAt(i, matrix);
    const e = matrix.elements, angle = i / 32 * Math.PI * 2 + 0.35;
    assert.ok(Math.abs(e[12] - Math.cos(angle) * 29.18) < 1e-4);
    assert.ok(Math.abs(e[13] - (35.2 + Math.sin(angle) * 29.18)) < 1e-4);
    assert.ok(Math.abs(e[14] - 2.8) < 1e-5);
    for (const k of [0, 5, 10]) assert.equal(e[k], 1);
    for (const k of [1, 2, 4, 6, 8, 9]) assert.equal(e[k], 0, 'cabins stay upright, without spinning with the rim');
  }
}
for (const t of [0, 4, 23, 61, 97]) {
  wheel.setTime(t); wheel.root.updateMatrixWorld(true);
  const box = exactVertexBounds(wheel.root);
  assert.ok(box.min.x >= C3_FERRIS_WHEEL_PLACEMENT.x - C3_FERRIS_WHEEL_PLACEMENT.safetyRadius && box.max.x <= C3_FERRIS_WHEEL_PLACEMENT.x + C3_FERRIS_WHEEL_PLACEMENT.safetyRadius);
  assert.ok(box.min.z >= C3_FERRIS_WHEEL_PLACEMENT.z - C3_FERRIS_WHEEL_PLACEMENT.safetyRadius && box.max.z <= C3_FERRIS_WHEEL_PLACEMENT.z + C3_FERRIS_WHEEL_PLACEMENT.safetyRadius);
}
wheel.setTime(0); wheel.update(2);
assert.ok(Math.abs(pivot.rotation.z - 0.00175) < 1e-12, 'stall delta is limited to source 0.05 s');
const beforeInvalid = pivot.rotation.z;
for (const dt of [0, -1, NaN, Infinity]) wheel.update(dt);
wheel.setTime(-1); wheel.setTime(NaN);
assert.equal(pivot.rotation.z, beforeInvalid);
const ownedGeometry = new Set(meshes.map(m => m.geometry));
const ownedMaterials = new Set(meshes.flatMap(m => Array.isArray(m.material) ? m.material : [m.material]));
const disposalCounts = new Map<object, number>();
for (const resource of [...ownedGeometry, ...ownedMaterials]) { disposalCounts.set(resource, 0); resource.addEventListener('dispose', () => disposalCounts.set(resource, disposalCounts.get(resource)! + 1)); }
const parent = new THREE.Group(); parent.add(wheel.root);
wheel.dispose(); wheel.dispose(); wheel.update(1);
assert.equal(parent.children.length, 0); assert.equal(wheel.root.children.length, 0);
for (const count of disposalCounts.values()) assert.equal(count, 1, 'each geometry/material is disposed exactly once, including BatchedMesh-owned packed geometry');
console.log('PASS: complete source hierarchy, original PBR glass, vertical XY rings, Z-axis rotation, upright cabins, layers, safe bounds, delta handling and idempotent deduplicated resource disposal.');
console.log(JSON.stringify(wheel.diagnostics, null, 2));
