import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAureliaBoatPrototypes } from './AureliaBoatPrototypes.js';
import { MARITIME_PLACEMENTS, YACHT_SCALE, validateMaritimeLayout, type MaritimePlacement, type VesselKind } from './SingaporeMaritimeLayout';
import { compactExactMarineGeometry } from './SingaporeMarineGeometry';

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4; kind: VesselKind; castShadow: boolean; receiveShadow: boolean; }
interface Binding { batch: THREE.BatchedMesh; id: number; local: THREE.Matrix4; }
interface VesselState { placement: MaritimePlacement; matrix: THREE.Matrix4; bindings: Binding[]; heave: number; pitch: number; roll: number; radarRig?: THREE.Group; radar?: THREE.Group; }

export interface MarineOceanGrid { width: number; depth: number; segmentsX: number; segmentsZ: number; }
const DEFAULT_OCEAN_GRID: MarineOceanGrid = { width: 6500, depth: 6500, segmentsX: 160, segmentsZ: 160 };

/** Same wave-height equations and crest knee as the EXISTING ocean shader. */
export function sampleC3MarineWave(x: number, z: number, t: number, strength = 0.84): number {
  const px = x + 3.40 * Math.sin(z * 0.018 + t * 0.09) + 1.40 * Math.sin(z * 0.047 - t * 0.15);
  const pz = z + 2.80 * Math.sin(x * 0.016 - t * 0.10) + 0.90 * Math.sin(x * 0.039 + z * 0.011 + t * 0.13);
  const h = 0.59 * Math.sin(px * 0.050 + pz * 0.022 + t * 0.62)
    + 0.31 * Math.sin(px * -0.037 + pz * 0.091 + t * 0.91 + 1.17)
    + 0.165 * Math.sin(px * 0.132 - pz * 0.096 + t * 1.13 + 2.36)
    + 0.085 * Math.sin(px * -0.172 - pz * 0.142 + t * 1.43 + 0.42)
    + 0.033 * Math.sin(px * 0.270 - pz * 0.205 + t * 1.72 + 1.80)
    + 0.055 * Math.sin(px * -0.088 + pz * 0.182 + t * 0.77 + 0.87)
    + 0.024 * Math.sin(px * 0.330 + pz * 0.052 + t * 1.92 + 2.08)
    + 0.045 * Math.sin(px * -0.214 + pz * 0.276 + t * 0.83 + 2.61)
    + 0.023 * Math.sin(px * 0.342 + pz * 0.173 + t * 2.03 + 0.38)
    + 0.016 * Math.sin(px * -0.284 - pz * 0.233 + t * 1.57 + 4.05);
  const raw = h * strength, excess = Math.max(0, raw - 0.26);
  return raw > 0.26 ? 0.26 + excess * 0.10 / (1 + excess * 2.2) : raw;
}

/** The ocean shader displaces a finite vertex grid. Its visible height BETWEEN
 * grid points is triangle interpolation, NOT a fresh analytic wave evaluation.
 * Ignoring this distinction can put a small RIB several decimetres above or
 * below the rendered sea. Existing horizontal crest drift changes this height
 * only by a few millimetres; the grid topology / all wave equations stay intact.
 */
export function sampleC3RenderedMarineWave(x: number, z: number, t: number, strength = 0.84, grid: MarineOceanGrid = DEFAULT_OCEAN_GRID): number {
  const stepX = grid.width / grid.segmentsX, stepZ = grid.depth / grid.segmentsZ;
  const gx = THREE.MathUtils.clamp((x + grid.width * 0.5) / stepX, 0, grid.segmentsX);
  const gz = THREE.MathUtils.clamp((z + grid.depth * 0.5) / stepZ, 0, grid.segmentsZ);
  const ix = Math.min(grid.segmentsX - 1, Math.floor(gx)), iz = Math.min(grid.segmentsZ - 1, Math.floor(gz));
  const fx = gx - ix, fz = gz - iz, x0 = ix * stepX - grid.width * 0.5, z0 = iz * stepZ - grid.depth * 0.5;
  const b = sampleC3MarineWave(x0, z0 + stepZ, t, strength);
  const d = sampleC3MarineWave(x0 + stepX, z0, t, strength);
  // THREE.PlaneGeometry's original diagonal joins (x0,z1) to (x1,z0).
  if (fx + fz <= 1) return sampleC3MarineWave(x0, z0, t, strength) * (1 - fx - fz) + b * fz + d * fx;
  return b * (1 - fx) + sampleC3MarineWave(x0 + stepX, z0 + stepZ, t, strength) * (fx + fz - 1) + d * (1 - fz);
}

function visibleThroughParents(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}
function isRadarPart(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o.userData.aureliaAnimated) return true;
  return false;
}
function normalizeGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone(); geometry.clearGroups();
  // Sequential indexing does NOT weld vertices, alter hard edges or decimate.
  if (!geometry.index) {
    const count = geometry.getAttribute('position').count;
    const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
  return geometry;
}
function bakeOriginalInstances(mesh: THREE.InstancedMesh): THREE.BufferGeometry {
  const copies: THREE.BufferGeometry[] = [];
  const transform = new THREE.Matrix4(), color = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) {
    const geometry = normalizeGeometry(mesh.geometry);
    mesh.getMatrixAt(i, transform); geometry.applyMatrix4(transform);
    if (mesh.instanceColor) {
      mesh.getColorAt(i, color);
      const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
      for (let j = 0; j < count; j++) { colors[j * 3] = color.r; colors[j * 3 + 1] = color.g; colors[j * 3 + 2] = color.b; }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    copies.push(geometry);
  }
  const merged = mergeGeometries(copies, false); copies.forEach(g => g.dispose());
  if (!merged) throw new Error('AURELIA original teak instance merge failed');
  return merged;
}
function geometryLayout(geometry: THREE.BufferGeometry): string {
  return Object.keys(geometry.attributes).sort().map(k => { const a = geometry.getAttribute(k) as THREE.BufferAttribute; return `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`; }).join('|');
}

/** Original geometry once per material batch; each vessel part is culled for
 * main, mirror and shadow cameras. No LOD, impostors or geometry reduction. */
export class SingaporeMaritimeFleet {
  readonly root = new THREE.Group();
  readonly placements = MARITIME_PLACEMENTS;
  readonly diagnostics: Record<string, unknown>;
  private readonly batches: THREE.BatchedMesh[] = [];
  private readonly vessels: VesselState[];
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly radarGeometries = new Set<THREE.BufferGeometry>();
  private readonly pose = new THREE.Object3D();
  private readonly matrix = new THREE.Matrix4();
  private readonly seaLevel: number;
  private readonly oceanGrid: MarineOceanGrid;
  private time = 0;
  private waveStrength = 0.84;
  private disposed = false;

  constructor(seaLevel: number, maxAnisotropy = 16, oceanGrid: MarineOceanGrid = DEFAULT_OCEAN_GRID) {
    const layout = validateMaritimeLayout();
    if (!layout.valid) throw new Error(`Unsafe maritime layout: ${layout.problems.join('; ')}`);
    this.seaLevel = seaLevel;
    this.oceanGrid = { ...oceanGrid };
    this.root.name = 'C3_MaritimeFleet'; this.root.userData.c3Maritime = true;
    this.vessels = this.placements.map(placement => ({ placement, matrix: new THREE.Matrix4(), bindings: [], heave: 0, pitch: 0, roll: 0 }));
    const prototypes = createAureliaBoatPrototypes(maxAnisotropy);
    const parts: Part[] = [], originalGeometries = new Set<THREE.BufferGeometry>();
    let originalVisibleTriangles = 0;
    const vertexMaterialCache = new Map<THREE.Material, THREE.Material>();
    const roots: [VesselKind, THREE.Group][] = [['yacht', prototypes.yacht], ['rescue', prototypes.rescue]];
    for (const [kind, root] of roots) {
      root.updateMatrixWorld(true);
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        originalGeometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(m => { this.materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) this.textures.add(value); });
        if (!visibleThroughParents(object) || isRadarPart(object)) return;
        const copies = this.placements.filter(p => p.kind === kind).length;
        originalVisibleTriangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1) * copies;
        let source = object.geometry, material = materials[0];
        if (object instanceof THREE.InstancedMesh) {
          source = bakeOriginalInstances(object);
          if (object.instanceColor) {
            if (!vertexMaterialCache.has(material)) {
              const vertexMaterial = material.clone() as THREE.MeshStandardMaterial;
              vertexMaterial.vertexColors = true; vertexMaterial.name = 'AURELIA_OriginalTeakInstanceColours';
              vertexMaterialCache.set(material, vertexMaterial); this.materials.add(vertexMaterial);
            }
            material = vertexMaterialCache.get(material)!;
          }
        }
        if (materials.length > 1) {
          for (const group of source.groups) {
            const geometry = normalizeGeometry(source), index = source.index!;
            geometry.setIndex(Array.from(index.array.slice(group.start, group.start + group.count)));
            parts.push({ geometry, material: materials[group.materialIndex ?? 0], local: object.matrixWorld.clone(), kind, castShadow: object.castShadow, receiveShadow: object.receiveShadow });
          }
        } else parts.push({ geometry: normalizeGeometry(source), material, local: object.matrixWorld.clone(), kind, castShadow: object.castShadow, receiveShadow: object.receiveShadow });
        if (source !== object.geometry) source.dispose();
      });
    }
    const verticesBeforeExactCompaction = parts.reduce((n, part) => n + part.geometry.getAttribute('position').count, 0);
    for (const part of parts) {
      const original = part.geometry;
      part.geometry = compactExactMarineGeometry(original);
      original.dispose();
    }
    // Compatibility includes precise attribute layout and original shadow state.
    const buckets = new Map<string, Part[]>();
    for (const part of parts) {
      const key = `${part.material.uuid}|${part.castShadow}|${part.receiveShadow}|${geometryLayout(part.geometry)}`;
      if (!buckets.has(key)) buckets.set(key, []); buckets.get(key)!.push(part);
    }
    let uploadedVertices = 0, logicalTriangles = 0, logicalInstances = 0;
    for (const entries of buckets.values()) {
      const maxInstances = entries.reduce((n, p) => n + this.vessels.filter(v => v.placement.kind === p.kind).length, 0);
      const vertexCount = entries.reduce((n, p) => n + p.geometry.getAttribute('position').count, 0);
      const indexCount = entries.reduce((n, p) => n + p.geometry.index!.count, 0), first = entries[0];
      const batch = new THREE.BatchedMesh(maxInstances, vertexCount, indexCount, first.material);
      batch.name = `C3_MarineBatch_${this.batches.length}_${first.material.type}`;
      batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
      batch.userData.c3NoShadow = !first.castShadow; batch.userData.c3MaritimeBatch = true;
      batch.perObjectFrustumCulled = true; batch.sortObjects = true;
      // Inner per-object culling is recomputed for each actual render camera.
      batch.frustumCulled = false; batch.layers.enable(1);
      batch.updateMatrix(); batch.matrixAutoUpdate = false;
      for (const part of entries) {
        const geometryId = batch.addGeometry(part.geometry);
        for (const vessel of this.vessels) {
          if (vessel.placement.kind !== part.kind) continue;
          const id = batch.addInstance(geometryId);
          vessel.bindings.push({ batch, id, local: part.local });
          logicalInstances++; logicalTriangles += part.geometry.index!.count / 3;
        }
        part.geometry.dispose();
      }
      uploadedVertices += vertexCount; this.batches.push(batch); this.root.add(batch);
    }
    for (const vessel of this.vessels) {
      if (vessel.placement.kind !== 'yacht') continue;
      const rig = new THREE.Group(); rig.name = `C3_${vessel.placement.id}_RadarPose`;
      rig.scale.setScalar(YACHT_SCALE);
      const radar = prototypes.radar.clone(true);
      prototypes.radar.matrixWorld.decompose(radar.position, radar.quaternion, radar.scale);
      radar.name = `C3_${vessel.placement.id}_OriginalRadar`;
      radar.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.userData.c3NoShadow = true; o.layers.enable(1); this.radarGeometries.add(o.geometry); } });
      rig.add(radar); this.root.add(rig); vessel.radarRig = rig; vessel.radar = radar;
    }
    for (const [, root] of roots) root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    for (const geometry of originalGeometries) if (!this.radarGeometries.has(geometry)) geometry.dispose();
    this.diagnostics = {
      yachts: 4, rescueCraft: 15, totalVessels: 19, seaLevel, placements: this.placements.map(p => ({ ...p })), layout,
      original: prototypes.diagnostics, fullDetail: true, lodOrDecimation: false,
      technique: 'Shared original geometry + material batches + per-object main/mirror/shadow frustum culling',
      flotation: 'Interpolated actual ocean vertex grid; existing waves and drift untouched', oceanGrid: this.oceanGrid,
      batches: this.batches.length, logicalInstances, uploadedVertices,
      verticesBeforeExactCompaction, exactAttributeCompaction: true,
      vertexReductionFraction: 1 - uploadedVertices / verticesBeforeExactCompaction,
      originalVisibleTrianglesExcludingRadar: originalVisibleTriangles, batchedLogicalTrianglesExcludingRadar: logicalTriangles,
      extraLights: 0, extraReflectionCameras: 0,
    };
    if (logicalTriangles !== originalVisibleTriangles) throw new Error('Maritime source triangle parity failed');
    this.root.userData.diagnostics = this.diagnostics; this.setTime(0);
    for (const batch of this.batches) {
      batch.computeBoundingSphere(); batch.computeBoundingBox();
      // The existing track shadow bubble reads geometry bounds.
      batch.geometry.boundingSphere = batch.boundingSphere!.clone(); batch.geometry.boundingSphere.radius += 1.5;
    }
  }
  update(dt: number, oceanTime?: number, waveStrength = this.waveStrength): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.waveStrength = waveStrength;
    this.time = Number.isFinite(oceanTime) ? oceanTime! : this.time + Math.min(dt, 0.1);
    this.applyTime(Math.min(dt, 0.1), false);
  }
  setTime(time: number): void { if (this.disposed || !Number.isFinite(time)) return; this.time = time; this.applyTime(0, true); }
  private applyTime(dt: number, immediate: boolean): void {
    const t = this.time, strength = this.waveStrength;
    for (const vessel of this.vessels) {
      const p = vessel.placement, yacht = p.kind === 'yacht', c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const long = yacht ? 15 * YACHT_SCALE : 2.4, beam = yacht ? 3.6 * YACHT_SCALE : 1.2;
      const centre = sampleC3RenderedMarineWave(p.x, p.z, t, strength, this.oceanGrid);
      const bow = sampleC3RenderedMarineWave(p.x - s * long, p.z - c * long, t, strength, this.oceanGrid);
      const stern = sampleC3RenderedMarineWave(p.x + s * long, p.z + c * long, t, strength, this.oceanGrid);
      const port = sampleC3RenderedMarineWave(p.x - c * beam, p.z + s * beam, t, strength, this.oceanGrid);
      const starboard = sampleC3RenderedMarineWave(p.x + c * beam, p.z - s * beam, t, strength, this.oceanGrid);
      const heave = centre * 0.5 + (bow + stern) * 0.25;
      const pitch = THREE.MathUtils.clamp((bow - stern) / (2 * long), yacht ? -0.014 : -0.06, yacht ? 0.014 : 0.06);
      const roll = THREE.MathUtils.clamp((starboard - port) / (2 * beam), yacht ? -0.018 : -0.065, yacht ? 0.018 : 0.065);
      const blend = immediate ? 1 : 1 - Math.exp(-dt * (yacht ? 2.4 : 5.5));
      vessel.heave += (heave - vessel.heave) * blend; vessel.pitch += (pitch - vessel.pitch) * blend; vessel.roll += (roll - vessel.roll) * blend;
      this.pose.position.set(p.x, this.seaLevel + vessel.heave + (yacht ? 0 : 0.06), p.z);
      this.pose.rotation.set(vessel.pitch, p.yaw, vessel.roll, 'YXZ'); this.pose.scale.setScalar(yacht ? YACHT_SCALE : 1); this.pose.updateMatrix(); vessel.matrix.copy(this.pose.matrix);
      for (const binding of vessel.bindings) { this.matrix.multiplyMatrices(vessel.matrix, binding.local); binding.batch.setMatrixAt(binding.id, this.matrix); }
      if (vessel.radarRig && vessel.radar) { vessel.radarRig.position.copy(this.pose.position); vessel.radarRig.quaternion.copy(this.pose.quaternion); vessel.radar.rotation.y = t * 0.45; }
    }
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.root.removeFromParent();
    this.batches.forEach(batch => batch.dispose()); this.radarGeometries.forEach(geometry => geometry.dispose());
    this.textures.forEach(texture => texture.dispose()); this.materials.forEach(material => material.dispose());
    this.root.clear(); this.batches.length = 0; this.vessels.forEach(v => { v.bindings.length = 0; });
    this.materials.clear(); this.textures.clear(); this.radarGeometries.clear();
  }
}
export function createSingaporeMaritimeFleet(seaLevel = -1.25, oceanGrid?: MarineOceanGrid): SingaporeMaritimeFleet { return new SingaporeMaritimeFleet(seaLevel, 16, oceanGrid); }
