import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(project, 'docs/reference/aurelia-original.html');
const destination = path.join(project, 'src/game/circuits/singapore/AureliaBoatPrototypes.js');
const html = fs.readFileSync(sourcePath, 'utf8');
const start = html.indexOf('      const mat = {};');
const endMarker = '      // Model geometry and the directional-light camera are static;';
const end = html.indexOf(endMarker);
if (start < 0 || end < start) throw new Error('Original AURELIA source markers changed');
let body = html.slice(start, end);
const pointLine = '        const point=new THREE.PointLight(color,intensity,distance,2); point.position.set(x,y,z); scene.add(point); pointLights.push(point); return bulb;';
if (!body.includes(pointLine)) throw new Error('Point light extraction marker changed');
body = body.replace(pointLine, '        // Keep the original luminous fitting, but use the circuit lighting; no extra lights.\n        return bulb;');
body = body.replace('      aftFill.intensity=0.28;\n', '');
// The viewport presentation only printed these counters. Keep them as returned diagnostics.
body = body.replace(/      console\.info\('AURELIA static draw-call optimization \(estimated main-pass savings\):', \{[\s\S]*?      \}\);\n/, '');
body = body.split('\n').map(line => line.startsWith('      ') ? line.slice(6) : line).join('\n');
const sourceSha256 = createHash('sha256').update(html).digest('hex');
const output = `/**
 * Faithful model extraction from docs/reference/aurelia-original.html.
 * Source SHA-256: ${sourceSha256}
 * All original geometry, UVs, procedural textures, tessellation, materials and
 * micro-details are retained. Only the separate presentation renderer/camera/
 * studio lights/post FX are not part of a game-world model.
 * Regenerate with: node scripts/extract-aurelia-models.mjs
 * This is JavaScript intentionally: it preserves the supplied model source;
 * the integration and fleet lifecycle are typed in SingaporeMaritimeFleet.ts.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createAureliaBoatPrototypes(maxAnisotropy = 16) {
  const scene = new THREE.Group();
  scene.name = 'AURELIA_Yacht_Prototype';
  // Texture capability input only, never a second renderer.
  const renderer = { capabilities: { getMaxAnisotropy: () => Math.max(1, maxAnisotropy) } };
  const random = (() => { let s = 19770923; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
${body.split('\n').map(line => '  ' + line).join('\n')}
  scene.remove(lifeboat);
  // Remove only the reference's alongside-yacht X/Z position; retain its
  // full-scale 1.55 transform and original -0.63 m waterline calibration.
  lifeboat.position.set(0, -0.63, 0);
  lifeboat.name = 'AURELIA_RescueRIB_Prototype';
  radarDish.name = 'AURELIA_RotatingRadar';
  radarDish.userData.aureliaAnimated = true;
  for (const root of [scene, lifeboat]) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!object.isMesh) return;
      object.userData.c3NoShadow = !object.castShadow;
      object.layers.enable(1);
    });
  }
  return {
    yacht: scene,
    rescue: lifeboat,
    radar: radarDish,
    diagnostics: {
      sourceSha256: '${sourceSha256}',
      design: 'Original AURELIA 45 m yacht and full-scale offshore rescue RIB',
      sourceGeometryAndTexturesPreserved: true,
      microShadows: microShadowStats,
      yachtBatching: yachtBatchStats,
      rescueBatching: rescueBatchStats,
      primitiveGeometryCacheHits,
      primitiveGeometryCacheMisses,
    },
  };
}
`;
fs.writeFileSync(destination, output);
console.log(`Generated ${path.relative(project, destination)} from original source (${output.split('\n').length} lines)`);
