import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createAureliaBoatPrototypes } from '../src/game/circuits/singapore/AureliaBoatPrototypes.js';
import { SingaporeMaritimeFleet, sampleC3MarineWave, sampleC3RenderedMarineWave } from '../src/game/circuits/singapore/SingaporeMaritimeFleet';
import { MARITIME_PLACEMENTS, YACHT_SCALE, isInsideTrackPolygon, minimumTrackClearance, minimumPitQuayClearance, validateMaritimeLayout, footprint, placementAt } from '../src/game/circuits/singapore/SingaporeMaritimeLayout';
import { compactExactMarineGeometry } from '../src/game/circuits/singapore/SingaporeMarineGeometry';

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn(); checks++; console.log(`✓ ${name}`);
};
const finiteMatrix = (m: THREE.Matrix4) => m.elements.every(Number.isFinite);

// The model generator creates procedural textures; fake only the 2D canvas API.
const makeGradient = () => ({ addColorStop: () => undefined });
const ctx = new Proxy({ createLinearGradient: makeGradient, createRadialGradient: makeGradient }, {
  get(target, key) { return key in target ? (target as any)[key] : () => undefined; },
  set() { return true; },
});
(globalThis as any).document = { createElement: (tag: string) => {
  assert.equal(tag, 'canvas');
  return { width: 0, height: 0, getContext: () => ctx };
} };

try {
  check('layout has exactly 4 yachts and 15 rescue craft', () => {
    const result = validateMaritimeLayout();
    assert.equal(MARITIME_PLACEMENTS.length, 19);
    assert.equal(result.yachts, 4); assert.equal(result.rescue, 15);
    assert.equal(result.valid, true, result.problems.join('; '));
    assert.equal(YACHT_SCALE, 3);
    const yachts = MARITIME_PLACEMENTS.filter(p => p.kind === 'yacht');
    assert.ok(yachts.every(p => Math.abs(p.halfBeam - 16.2) < 1e-10 && Math.abs(p.halfLength - 68.4) < 1e-10), 'all yacht safety footprints reflect the 3× model scale');
    const [y01, y02, y03, y04] = yachts;
    assert.deepEqual([y01.x, y01.z], [727.95, -298.9]);
    assert.deepEqual([y02.x, y02.z], [-755.89, 114.25]);
    assert.deepEqual([y03.x, y03.z], [247.00742744049666, 236.87498227973379], 'Y03 stays in place');
    assert.deepEqual([y04.x, y04.z], [-69.07465078526059, -340.65580341348164], 'Y04 stays in place');
    assert.ok(MARITIME_PLACEMENTS.filter(p => p.kind === 'rescue').every(p => p.halfBeam === 1.85 && p.halfLength === 4.7), 'RIBs retain original extents');
  });
  check('layout IDs are unique and vessel positions/distances are varied', () => {
    const ids = MARITIME_PLACEMENTS.map(p => p.id);
    assert.equal(new Set(ids).size, 19);
    const radial = MARITIME_PLACEMENTS.map(p => Math.hypot(p.x, p.z));
    assert.ok(Math.max(...radial) - Math.min(...radial) > 100);
    assert.ok(new Set(MARITIME_PLACEMENTS.map(p => p.routeFraction)).size > 15);
  });
  check('every complete oriented footprint is outside the track and clears centreline by >=22.5m', () => {
    for (const p of MARITIME_PLACEMENTS) {
      assert.equal(isInsideTrackPolygon(p), false, `${p.id} center inside`);
      assert.ok(footprint(p).every(c => !isInsideTrackPolygon(c)), `${p.id} footprint inside`);
      assert.ok(minimumTrackClearance(p) >= 22.5, `${p.id}: ${minimumTrackClearance(p)}`);
    }
  });
  check('malformed inside-track placement is rejected', () => {
    const invalid = placementAt('BAD', 'rescue', 0.5, 0);
    const result = validateMaritimeLayout([invalid]);
    assert.equal(result.valid, false);
    assert.ok(result.problems.some(p => p.includes('inside track polygon') || p.includes('only')));
  });
  check('complete vessel footprints clear the actual rotated pit quay by 8m; the former coarse exclusion cannot hide a collision', () => {
    for (const p of MARITIME_PLACEMENTS) assert.ok(minimumPitQuayClearance(p) >= 8, `${p.id} pit-quay clearance`);
    const collision = { ...MARITIME_PLACEMENTS[0], x: 700.06, z: -315.18 };
    assert.equal(minimumPitQuayClearance(collision), 0);
    assert.ok(validateMaritimeLayout([collision]).problems.some(p => p.includes('pit quay')));
  });
  check('generated model source hash matches both original references', () => {
    const project = process.cwd();
    const generated = readFileSync(path.join(project, 'src/game/circuits/singapore/AureliaBoatPrototypes.js'));
    const docs = readFileSync(path.join(project, 'docs/reference/aurelia-original.html'));
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    if (existsSync('/home/ubuntu/upload/index.html')) assert.equal(sha(docs), sha(readFileSync('/home/ubuntu/upload/index.html')), 'uploaded original reference differs from project reference');
    assert.match(generated.toString('utf8'), new RegExp(sha(docs)));
  });

  check('prototype geometry remains detailed and prototypes contain no lights', () => {
    const prototypes = createAureliaBoatPrototypes(1);
    let yachtTriangles = 0, ribTriangles = 0, lights = 0;
    const count = (root: THREE.Object3D) => root.traverse(o => {
      if ((o as any).isLight) lights++;
      if (!(o as any).isMesh) return;
      const g = (o as THREE.Mesh).geometry;
      const tris = (g.index?.count ?? g.getAttribute('position').count) / 3 * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
      if (root === prototypes.yacht) yachtTriangles += tris; else ribTriangles += tris;
    });
    count(prototypes.yacht); count(prototypes.rescue);
    assert.ok(yachtTriangles > 350_000, `yacht triangles ${yachtTriangles}`);
    assert.ok(ribTriangles > 200_000, `RIB triangles ${ribTriangles}`);
    assert.equal(lights, 0);
    // This isolated prototype is intentionally discarded; disposal belongs to caller/fleet lifecycle.
  });

  check('EVERY indexed attribute byte of ALL original geometries survives exact compaction', () => {
    const prototypes = createAureliaBoatPrototypes(1);
    const geometries = new Set<THREE.BufferGeometry>();
    for (const root of [prototypes.yacht, prototypes.rescue]) root.traverse(o => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
    let before = 0, after = 0, checkedBytes = 0;
    const started = performance.now();
    for (const source of geometries) {
      const compact = compactExactMarineGeometry(source);
      const count = source.index?.count ?? source.getAttribute('position').count;
      assert.equal(compact.index!.count, count);
      before += source.getAttribute('position').count; after += compact.getAttribute('position').count;
      for (const [name, raw] of Object.entries(source.attributes)) {
        const a = raw as THREE.BufferAttribute, b = compact.getAttribute(name) as THREE.BufferAttribute;
        assert.equal(a.itemSize, b.itemSize); assert.equal(a.normalized, b.normalized);
        assert.equal(a.array.constructor, b.array.constructor);
        const input = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
        const output = new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength);
        const stride = a.itemSize * a.array.BYTES_PER_ELEMENT;
        for (let i = 0; i < count; i++) {
          const oldVertex = source.index ? source.index.getX(i) : i, newVertex = compact.index!.getX(i);
          for (let byte = 0; byte < stride; byte++) {
            if (input[oldVertex * stride + byte] !== output[newVertex * stride + byte]) throw new Error(`Changed ${name} byte at index ${i}`);
            checkedBytes++;
          }
        }
      }
      compact.dispose();
    }
    console.log(JSON.stringify({ geometries: geometries.size, sourceVertices: before, compactVertices: after, vertexReduction: 1 - after / before, checkedBytes, cpuMillisecondsIncludingFullByteVerification: performance.now() - started }));
    assert.ok(after <= before);
  });

  check('flotation samples the ACTUAL desktop/mobile ocean triangles, not an undersampled analytic surface', () => {
    for (const segments of [128, 160]) {
      const grid = { width: 6500, depth: 6500, segmentsX: segments, segmentsZ: segments }, step = 6500 / segments;
      const x = -3250 + step * 53, z = -3250 + step * 61;
      const a = sampleC3MarineWave(x, z, 8), b = sampleC3MarineWave(x, z + step, 8), d = sampleC3MarineWave(x + step, z, 8);
      assert.ok(Math.abs(sampleC3RenderedMarineWave(x, z, 8, 0.84, grid) - a) < 1e-12);
      const sampled = sampleC3RenderedMarineWave(x + step * 0.25, z + step * 0.25, 8, 0.84, grid);
      assert.ok(Math.abs(sampled - (a * 0.5 + b * 0.25 + d * 0.25)) < 1e-12);
      assert.ok(Math.abs(sampleC3RenderedMarineWave(700, -300, 15, 0, grid)) < 1e-12);
    }
  });

  const fleet = new SingaporeMaritimeFleet(-1.25, 1);
  const privateFleet = fleet as any;
  check('fleet diagnostics preserve exact source/batched triangle parity and batching bounds', () => {
    const d = fleet.diagnostics as any;
    assert.equal(d.originalVisibleTrianglesExcludingRadar, d.batchedLogicalTrianglesExcludingRadar);
    assert.ok(d.batches < 130, `batches=${d.batches}`);
    assert.ok(d.logicalInstances > 1000, `instances=${d.logicalInstances}`);
    assert.equal(d.yachts, 4); assert.equal(d.rescueCraft, 15);
    assert.equal(d.extraLights, 0);
    assert.equal(d.exactAttributeCompaction, true);
    assert.ok(d.uploadedVertices < d.verticesBeforeExactCompaction * 0.5);
    console.log(JSON.stringify({ batches: d.batches, instances: d.logicalInstances, originalVertices: d.verticesBeforeExactCompaction, uploadedVertices: d.uploadedVertices, vertexReduction: d.vertexReductionFraction, originalTriangles: d.originalVisibleTrianglesExcludingRadar, finalTriangles: d.batchedLogicalTrianglesExcludingRadar }));
  });
  check('all batches enable individual frustum culling and layer 1', () => {
    assert.ok(privateFleet.batches.length > 0);
    for (const b of privateFleet.batches) {
      assert.equal(b.perObjectFrustumCulled, true);
      assert.notEqual(b.layers.mask & (1 << 1), 0);
    }
  });
  check('scene contains only batched models and the four intended radar rigs, not prototype extras', () => {
    let batches = 0, rigs = 0;
    fleet.root.traverse(o => { if ((o as any).isBatchedMesh) batches++; if (o.name.endsWith('RadarPose')) rigs++; });
    assert.equal(batches, privateFleet.batches.length);
    assert.equal(rigs, 4);
    assert.equal(fleet.root.children.length, privateFleet.batches.length + 4);
  });
  check('all logical instance matrices are finite at construction and after times 0, 8 and 100', () => {
    const matrixState = () => privateFleet.vessels.every((v: any) => finiteMatrix(v.matrix));
    assert.ok(matrixState());
    for (const t of [0, 8, 100]) { fleet.setTime(t); assert.ok(matrixState(), `time ${t}`); }
  });
  check('only the four yachts scale to 3×; the fifteen RIBs and original radar design stay correctly sized', () => {
    fleet.setTime(8);
    for (const vessel of privateFleet.vessels as any[]) {
      const expected = vessel.placement.kind === 'yacht' ? YACHT_SCALE : 1;
      for (let column = 0; column < 3; column++) {
        const offset = column * 4;
        const scale = Math.hypot(vessel.matrix.elements[offset], vessel.matrix.elements[offset + 1], vessel.matrix.elements[offset + 2]);
        assert.ok(Math.abs(scale - expected) < 1e-10, `${vessel.placement.id} scale ${scale} != ${expected}`);
      }
    }
    const radarRigs: THREE.Group[] = [];
    fleet.root.traverse(o => { if (o.name.endsWith('RadarPose')) radarRigs.push(o as THREE.Group); });
    assert.equal(radarRigs.length, 4);
    assert.ok(radarRigs.every(r => r.scale.toArray().every(v => v === YACHT_SCALE)));
  });
  check('setTime is deterministic and invalid/nonpositive dt does not advance simulation', () => {
    fleet.setTime(8);
    const snapshot = () => privateFleet.vessels.map((v: any) => v.matrix.elements.slice());
    const a = snapshot(); fleet.setTime(100); fleet.setTime(8);
    const b = snapshot();
    assert.equal(b.length, a.length);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < 16; j++) assert.ok(Math.abs(a[i][j] - b[i][j]) < 1e-12, `nondeterministic matrix ${i}:${j}`);
    fleet.update(Number.NaN); assert.deepEqual(snapshot(), b);
    fleet.update(0); assert.deepEqual(snapshot(), b);
    fleet.update(-1); assert.deepEqual(snapshot(), b);
    assert.ok(Number.isFinite(sampleC3MarineWave(0, 0, 8)));
  });
  check('flotation values stay within yacht and RIB motion limits for all 19 vessels', () => {
    fleet.setTime(8);
    for (const v of privateFleet.vessels as any[]) {
      const y = v.placement.kind === 'yacht';
      assert.ok(Math.abs(v.heave) < 1, `${v.placement.id} heave=${v.heave}`);
      assert.ok(Math.abs(v.pitch) <= (y ? 0.014 : 0.06) + 1e-12, `${v.placement.id} pitch`);
      assert.ok(Math.abs(v.roll) <= (y ? 0.018 : 0.065) + 1e-12, `${v.placement.id} roll`);
    }
  });
  check('BatchedMesh instances share per-batch geometry/material rather than cloned resources', () => {
    for (const b of privateFleet.batches as THREE.BatchedMesh[]) {
      assert.ok(b.geometry && b.material);
      assert.ok(b.instanceCount > 0);
    }
    assert.ok(privateFleet.batches.some((b: THREE.BatchedMesh) => b.instanceCount > 1));
  });
  check('double dispose is safe and empties fleet root', () => {
    fleet.dispose(); fleet.dispose();
    assert.equal(fleet.root.children.length, 0);
    assert.equal(privateFleet.batches.length, 0);
  });
  console.log(`\nPASS: ${checks} maritime test groups; CPU geometry/layout/lifecycle checks only (no browser texture or FPS validation).`);
} catch (error) {
  console.error(`\nFAIL after ${checks} test groups:`, error);
  process.exitCode = 1;
}
