import * as THREE from 'three';
import { createFerrisWheelPrototype } from './FerrisWheelPrototype.js';
import { C3_FERRIS_WHEEL_PLACEMENT, C3_FERRIS_WHEEL_SCALE, validateC3FerrisWheelPlacement } from './SingaporeFerrisWheelLayout';

/** The supplied complete model, attached to the existing Circuit 3 render loop. */
export class SingaporeFerrisWheel {
  readonly root: THREE.Group;
  readonly diagnostics: Record<string, unknown>;
  private readonly model: ReturnType<typeof createFerrisWheelPrototype>;
  private elapsed = 0;
  private disposed = false;

  constructor(seaLevel: number) {
    if (!Number.isFinite(seaLevel)) throw new RangeError('Ferris-wheel sea level must be finite');
    const layout = validateC3FerrisWheelPlacement();
    if (!layout.valid) throw new RangeError(`Unsafe ferris-wheel layout: ${layout.problems.join('; ')}`);
    this.model = createFerrisWheelPrototype();
    this.root = this.model.root;
    const placement = C3_FERRIS_WHEEL_PLACEMENT;
    this.root.position.set(placement.x, seaLevel + placement.baseHeightAboveSea, placement.z);
    this.root.rotation.y = placement.yaw;
    this.root.scale.setScalar(C3_FERRIS_WHEEL_SCALE);
    this.root.updateMatrix(); this.root.matrixAutoUpdate = false;
    this.model.setAngle(0); this.root.updateMatrixWorld(true);

    // The host shadow bubble reads geometry bounds, rather than InstancedMesh bounds.
    // Give cabin batches their complete sweep envelope while BatchedMesh retains its
    // own precise per-instance geometry bounds for each main/mirror/shadow camera.
    for (const batch of this.model.cabinBatches) {
      batch.mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 32.8, 2.8), 34.7);
    }
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    let meshes = 0, logicalTriangles = 0, drawBatches = 0, instancedBatches = 0, glassBatches = 0;
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++; drawBatches++; geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      const triangles = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      if (object instanceof THREE.BatchedMesh) { glassBatches++; logicalTriangles += triangles * object.instanceCount; }
      else if (object instanceof THREE.InstancedMesh) { instancedBatches++; logicalTriangles += triangles * object.count; }
      else logicalTriangles += triangles;
    });
    this.diagnostics = {
      source: 'User-provided noria_optimizada.html; original geometric construction and PBR materials',
      ...this.model.parameters,
      appliedScale: C3_FERRIS_WHEEL_SCALE,
      placement: { ...placement, baseWorldY: this.root.position.y, seaLevel }, layout,
      fullDetail: true, lodOrDecimation: false, preservedCabinHierarchy: true,
      transparentTechnique: 'Shared glass geometry; BatchedMesh per-camera instance sorting and culling',
      staticTechnique: 'Source material-compatible mesh merging; immutable local matrices with live parent transforms',
      meshes, drawBatches, instancedBatches, glassBatches, uniqueGeometries: geometries.size,
      uniqueMaterials: materials.size, logicalTriangles,
      extraLights: 0, extraRenderLoops: 0, extraReflectionCameras: 0,
      rigidMarineFoundation: true, physicsBodies: 0, angle: 0,
    };
    this.root.userData.c3FerrisWheel = this.diagnostics;
  }

  /** One visual update per rendered frame; no physics substeps or new RAF loop. */
  update(dt: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.setTime(this.elapsed + Math.min(dt, 0.05));
  }

  /** Deterministic phase for reproducible screenshot and animation tests. */
  setTime(time: number): void {
    if (this.disposed || !Number.isFinite(time) || time < 0) return;
    this.elapsed = time;
    const angle = (time * this.model.parameters.angularSpeed) % (Math.PI * 2);
    this.model.setAngle(angle);
    this.diagnostics.angle = angle;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.BatchedMesh) object.dispose(); // Owns its packed geometry and internal data textures.
      else {
        geometries.add(object.geometry);
        if (object instanceof THREE.InstancedMesh) object.dispose(); // Instance buffers only; geometry is shared/deduplicated below.
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.root.clear();
  }
}
