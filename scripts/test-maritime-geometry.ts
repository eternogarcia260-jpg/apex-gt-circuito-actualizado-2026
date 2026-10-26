import assert from 'node:assert/strict';
import * as THREE from 'three';
import { compactExactMarineGeometry } from '../src/game/circuits/singapore/SingaporeMarineGeometry.ts';

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0, // 0: duplicate target
  1, 0, 0, // 1
  0, 1, 0, // 2
  0, 0, 0, // 3: same position, different normal/UV/color seam
  1, 0, 0, // 4: exact duplicate of 1
  9, 9, 9, // 5: unreferenced
], 3));
geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1,
], 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
  0, 0, 1, 0, 0, 1, 0.25, 0.25, 1, 0, 0, 0,
], 2));
geometry.setAttribute('color', new THREE.Uint8BufferAttribute([
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 255, 255, 12, 34, 56,
], 3, true));
geometry.setIndex([0, 1, 2, 3, 4, 2]);
geometry.addGroup(0, 3, 0);
geometry.addGroup(3, 3, 1);
geometry.setDrawRange(1, 4);
geometry.name = 'exact-fixture';
geometry.userData.marker = { safe: true };

const cloneBefore = geometry.clone();
const compact = compactExactMarineGeometry(geometry);
assert.equal(compact.getAttribute('position').count, 4, 'exact duplicate 1/4 deduped; seam 0/3 retained; unreferenced 5 omitted');
assert.deepEqual(Array.from(compact.index!.array), [0, 1, 2, 3, 1, 2]);
assert.equal(compact.getIndex()!.count, geometry.getIndex()!.count);
assert.deepEqual(compact.groups, geometry.groups);
assert.deepEqual(compact.drawRange, geometry.drawRange);
assert.equal(compact.name, geometry.name);
assert.deepEqual(compact.userData, geometry.userData);

const originalIndex = geometry.getIndex()!;
const newIndex = compact.getIndex()!;
for (const [name, sourceRaw] of Object.entries(geometry.attributes)) {
  const source = sourceRaw as THREE.BufferAttribute;
  const result = compact.getAttribute(name) as THREE.BufferAttribute;
  assert.equal(result.itemSize, source.itemSize);
  assert.equal(result.normalized, source.normalized);
  assert.equal(result.array.constructor, source.array.constructor);
  for (let i = 0; i < originalIndex.count; i++) {
    const oldVertex = originalIndex.getX(i);
    const newVertex = newIndex.getX(i);
    for (let c = 0; c < source.itemSize; c++) {
      const a = source.array[oldVertex * source.itemSize + c];
      const b = result.array[newVertex * result.itemSize + c];
      assert.equal(Object.is(a, b) || a === b, true, `${name}[index ${i}, component ${c}] differs`);
    }
  }
}
assert.equal(geometry.getAttribute('position').count, cloneBefore.getAttribute('position').count, 'input not modified');
assert.deepEqual(Array.from(geometry.index!.array), Array.from(cloneBefore.index!.array), 'input index not modified');

// Distinct Float32 bit patterns (-0 vs +0) must not be welded.
const bitGeometry = new THREE.BufferGeometry();
bitGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0, 0, 0, 0, 0, 0], 3));
bitGeometry.setIndex([0, 1, 0]);
assert.equal(compactExactMarineGeometry(bitGeometry).getAttribute('position').count, 2);

// Morph data uses the documented safe clone fallback.
const morph = new THREE.BufferGeometry();
morph.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
morph.morphAttributes.position = [new THREE.Float32BufferAttribute([1, 0, 0], 3)];
const morphResult = compactExactMarineGeometry(morph);
assert.notEqual(morphResult, morph);
assert.equal(morphResult.morphAttributes.position?.length, 1);

console.log('PASS: exact seam-preserving compaction, bitwise component equivalence, unreferenced vertex removal, immutable input, and morph fallback.');
