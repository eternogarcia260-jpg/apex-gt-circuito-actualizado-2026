import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { C3_FERRIS_WHEEL_PLACEMENT } from './SingaporeFerrisWheelLayout';
import {
  isInsideTrackPolygon,
  MARITIME_PLACEMENTS,
} from './SingaporeMaritimeLayout';
import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';

const MODEL_URL = '/models/gothic_statue_2k.gltf';
const TRACK_ROADBED_HALF_WIDTH = 12.5;
const MIN_ROADBED_GAP = 12;
const MIN_FERRIS_WHEEL_GAP = 100;
const MIN_VESSEL_GAP = 15;

/** Triple the supplied ~32 m landmark; the complete 66 m-radius footprint stays clear. */
export const C3_GOTHIC_STATUE_PLACEMENT = Object.freeze({
  x: 130,
  z: 20,
  yaw: 0,
  scale: 55.5,
  groundY: -0.06,
  /** Conservative radius from the supplied model's full X/Z bounds at triple scale. */
  footprintRadius: 66,
});

function distanceToTrack(x: number, z: number): number {
  let minimum = Infinity;
  for (let i = 0; i < SINGAPORE_WAYPOINTS.length; i++) {
    const a = SINGAPORE_WAYPOINTS[i];
    const b = SINGAPORE_WAYPOINTS[(i + 1) % SINGAPORE_WAYPOINTS.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1,
      ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1),
    ));
    minimum = Math.min(minimum, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return minimum;
}

export function validateC3GothicStatuePlacement() {
  const p = C3_GOTHIC_STATUE_PLACEMENT;
  const finite = Object.values(p).every(Number.isFinite);
  if (!finite || p.scale <= 0 || p.footprintRadius <= 0) {
    return {
      valid: false,
      problems: ['Invalid Circuit 3 statue placement or scale'],
      insideTrack: false,
      trackRoadbedGap: 0,
      ferrisWheelGap: 0,
      nearestVessel: null as string | null,
      nearestVesselGap: 0,
    };
  }

  const insideTrack = isInsideTrackPolygon(p)
    && Array.from({ length: 64 }, (_, i) => {
      const angle = i * Math.PI * 2 / 64;
      return isInsideTrackPolygon({
        x: p.x + Math.cos(angle) * p.footprintRadius,
        z: p.z + Math.sin(angle) * p.footprintRadius,
      });
    }).every(Boolean);
  const centrelineDistance = distanceToTrack(p.x, p.z);
  const trackRoadbedGap = centrelineDistance - p.footprintRadius - TRACK_ROADBED_HALF_WIDTH;
  const ferrisWheelGap = Math.hypot(
    p.x - C3_FERRIS_WHEEL_PLACEMENT.x,
    p.z - C3_FERRIS_WHEEL_PLACEMENT.z,
  ) - p.footprintRadius - C3_FERRIS_WHEEL_PLACEMENT.safetyRadius;

  let nearestVessel: string | null = null;
  let nearestVesselGap = Infinity;
  for (const vessel of MARITIME_PLACEMENTS) {
    const gap = Math.hypot(p.x - vessel.x, p.z - vessel.z)
      - p.footprintRadius - Math.hypot(vessel.halfBeam, vessel.halfLength);
    if (gap < nearestVesselGap) {
      nearestVesselGap = gap;
      nearestVessel = vessel.id;
    }
  }

  const problems: string[] = [];
  if (!insideTrack) problems.push('The full statue footprint must stay inside the Circuit 3 route');
  if (trackRoadbedGap < MIN_ROADBED_GAP) problems.push('The statue is too close to the Circuit 3 roadbed');
  if (ferrisWheelGap < MIN_FERRIS_WHEEL_GAP) problems.push('The statue must remain far from the Ferris wheel');
  if (nearestVesselGap < MIN_VESSEL_GAP) problems.push(`The statue is too close to vessel ${nearestVessel}`);

  return {
    valid: problems.length === 0,
    problems,
    insideTrack,
    centrelineDistance,
    trackRoadbedGap,
    ferrisWheelGap,
    nearestVessel,
    nearestVesselGap,
  };
}

function disposeLoadedScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

/** One static, imported landmark owned only by Singapore/Circuit 3. */
export class SingaporeGothicStatue {
  readonly root = new THREE.Group();
  readonly diagnostics = {
    source: MODEL_URL,
    circuit: 'singapore_marina',
    placement: { ...C3_GOTHIC_STATUE_PLACEMENT },
    loaded: false,
    loadState: 'loading' as 'loading' | 'loaded' | 'error' | 'disposed',
    meshCount: 0,
    triangles: 0,
    modelSize: [0, 0, 0] as [number, number, number],
    worldHeight: 0,
    placementValidation: validateC3GothicStatuePlacement(),
    shadowCasting: true,
    lightsAdded: 0,
  };

  private readonly loader = new GLTFLoader();
  private readonly modelOffset = new THREE.Group();
  private modelScene: THREE.Object3D | null = null;
  private disposed = false;

  constructor(onReady: (meshes: THREE.Mesh[]) => void = () => {}) {
    if (!this.diagnostics.placementValidation.valid) {
      throw new Error(`Unsafe C3 gothic statue layout: ${this.diagnostics.placementValidation.problems.join('; ')}`);
    }

    const p = C3_GOTHIC_STATUE_PLACEMENT;
    this.root.name = 'C3_GothicStatue';
    this.root.userData.c3GothicStatue = this.diagnostics;
    this.root.position.set(p.x, p.groundY, p.z);
    this.root.rotation.y = p.yaw;
    this.root.scale.setScalar(p.scale);
    this.root.add(this.modelOffset);
    void this.loadModel(onReady);
  }

  private async loadModel(onReady: (meshes: THREE.Mesh[]) => void): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(MODEL_URL);
      if (this.disposed) {
        disposeLoadedScene(gltf.scene);
        return;
      }

      const model = gltf.scene;
      model.name = 'C3_GothicStatue_GLTF';
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) throw new Error('The Gothic Statue GLTF has no renderable bounds');
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      this.modelOffset.position.set(-center.x, -bounds.min.y, -center.z);
      this.modelOffset.add(model);
      this.modelScene = model;

      const meshes: THREE.Mesh[] = [];
      let triangles = 0;
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes.push(object);
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3;
        object.castShadow = true;
        object.receiveShadow = true;
        object.layers.enable(1);
        if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      });

      this.diagnostics.loaded = true;
      this.diagnostics.loadState = 'loaded';
      this.diagnostics.meshCount = meshes.length;
      this.diagnostics.triangles = triangles;
      this.diagnostics.modelSize = [size.x, size.y, size.z];
      this.diagnostics.worldHeight = size.y * C3_GOTHIC_STATUE_PLACEMENT.scale;
      this.root.userData.c3GothicStatue = this.diagnostics;
      this.root.updateMatrixWorld(true);
      onReady(meshes);
    } catch (error) {
      if (this.disposed) return;
      this.diagnostics.loadState = 'error';
      this.root.userData.c3GothicStatue = this.diagnostics;
      console.warn('[Circuit 3] No se pudo cargar la estatua gótica:', error);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.diagnostics.loadState = 'disposed';
    this.root.removeFromParent();
    if (this.modelScene) {
      disposeLoadedScene(this.modelScene);
      this.modelScene = null;
    }
    this.root.clear();
  }
}
