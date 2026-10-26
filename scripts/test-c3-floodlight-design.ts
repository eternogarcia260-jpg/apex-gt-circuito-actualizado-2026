import assert from 'node:assert/strict';
import * as THREE from 'three';

// The rig creates its procedural textures in-browser; this lightweight canvas shim
// lets the geometry and orientation checks run under Node without a WebGL context.
(globalThis as any).document = {
  createElement: () => ({
    width: 1,
    height: 1,
    getContext: () => ({
      createImageData: (width: number, height: number) => ({
        width, height, data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: () => undefined,
    }),
  }),
};

const [{ buildC3FloodlightRig, createC3FloodlightSteelMaterial }, { SINGAPORE_WAYPOINTS }] = await Promise.all([
  import('../src/game/circuits/singapore/SingaporeFloodlightDesign'),
  import('../src/game/circuits/singapore/SingaporeWaypoints'),
]);

const poleMaterial = createC3FloodlightSteelMaterial();
const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const rig = buildC3FloodlightRig(SINGAPORE_WAYPOINTS, 7, poleMaterial, concreteMaterial);
const diagnostics = rig.userData.c3FloodlightDesign;

assert.ok(diagnostics.fixtureCount > 100, `Expected circuit-wide masts, got ${diagnostics.fixtureCount}`);
assert.equal(diagnostics.modulesPerFixture, 6);
assert.equal(diagnostics.opticsPerModule, 18);
assert.equal(diagnostics.sealedOpticCount, diagnostics.fixtureCount * 108);
assert.ok(diagnostics.spatialBatches > 1, 'Masts should be split into spatially culled batches');
assert.ok(diagnostics.minimumOpticAimDot > 0.99, `Head axis is not aimed at track: ${diagnostics.minimumOpticAimDot}`);

let headBatchCount = 0;
let headInstanceCount = 0;
let headTriangleCount = 0;
rig.traverse(object => {
  if (!(object instanceof THREE.InstancedMesh)) return;
  if (!object.name.startsWith('C3_SixModuleFloodlight')) return;
  headBatchCount++;
  headInstanceCount += object.count;
  headTriangleCount += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 * object.count;
  assert.equal(object.castShadow, false, `${object.name} should not add shadow-map cost`);
});

assert.equal(headInstanceCount, diagnostics.fixtureCount * 4, 'Each mast should instance four merged head layers');
assert.equal(headBatchCount, diagnostics.spatialBatches * 4, 'Each spatial batch should use four head draw calls');
assert.ok(headTriangleCount > 0 && Number.isFinite(headTriangleCount));
assert.ok(headTriangleCount < 1_800_000, `Merged head geometry exceeds the mobile triangle budget: ${headTriangleCount}`);

console.log(JSON.stringify({
  fixtures: diagnostics.fixtureCount,
  modules: diagnostics.fixtureCount * diagnostics.modulesPerFixture,
  opticalCells: diagnostics.sealedOpticCount,
  spatialBatches: diagnostics.spatialBatches,
  headLayerDraws: headBatchCount,
  totalHeadInstances: headInstanceCount,
  estimatedHeadTriangles: Math.round(headTriangleCount),
  minimumAimDot: Number(diagnostics.minimumOpticAimDot.toFixed(5)),
}, null, 2));
