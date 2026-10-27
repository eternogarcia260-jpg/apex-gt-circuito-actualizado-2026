import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  footprint,
  isInsideTrackPolygon,
  MARITIME_PLACEMENTS,
  minimumTrackClearance,
  placementAt,
} from './SingaporeMaritimeLayout';
import { C3_FERRIS_WHEEL_PLACEMENT } from './SingaporeFerrisWheelLayout';
import { sampleC3RenderedMarineWave, type MarineOceanGrid } from './SingaporeMaritimeFleet';

const MODEL_URL = '/models/dutch_ship_large_01_2k.gltf';
const SHIP_ROUTE_POSE = placementAt('C3_DUTCH_SHIP', 'yacht', 0.23, 20);
// The imported model's long axis is local +X (rather than the fleet's local -Z).
const SHIP_PLACEMENT = Object.freeze({
  x: SHIP_ROUTE_POSE.x,
  z: SHIP_ROUTE_POSE.z,
  yaw: SHIP_ROUTE_POSE.yaw + Math.PI / 2,
});
const SHIP_HALF_BEAM = 4.35;
const SHIP_HALF_LENGTH = 17.2;
const SHIP_WAVE_HALF_LENGTH = 15.5;
const SHIP_WAVE_HALF_BEAM = 3.5;
const MIN_SAFE_CLEARANCE = 8;
const MIN_TRACK_CLEARANCE = 14;

function validatePlacement() {
  // The source model's long axis is local +X; in SingaporeMaritimeLayout the
  // equivalent long axis is local -Z, hence the quarter-turn for footprint tests.
  const footprintPose = {
    id: 'C3_DUTCH_SHIP',
    kind: 'yacht' as const,
    x: SHIP_PLACEMENT.x,
    z: SHIP_PLACEMENT.z,
    yaw: SHIP_PLACEMENT.yaw + Math.PI / 2,
    halfBeam: SHIP_HALF_BEAM,
    halfLength: SHIP_HALF_LENGTH,
    routeFraction: 0,
    outwardOffset: 0,
  };
  const corners = footprint(footprintPose);
  const trackClearance = minimumTrackClearance(footprintPose);
  const shipRadius = Math.hypot(SHIP_HALF_BEAM, SHIP_HALF_LENGTH);
  const nearestVessel = MARITIME_PLACEMENTS
    .map((vessel) => ({
      id: vessel.id,
      clearance: Math.hypot(vessel.x - SHIP_PLACEMENT.x, vessel.z - SHIP_PLACEMENT.z)
        - Math.hypot(vessel.halfBeam, vessel.halfLength)
        - shipRadius,
    }))
    .sort((a, b) => a.clearance - b.clearance)[0];
  const wheelClearance = Math.hypot(
    C3_FERRIS_WHEEL_PLACEMENT.x - SHIP_PLACEMENT.x,
    C3_FERRIS_WHEEL_PLACEMENT.z - SHIP_PLACEMENT.z,
  ) - C3_FERRIS_WHEEL_PLACEMENT.safetyRadius - shipRadius;
  const problems: string[] = [];

  if (isInsideTrackPolygon({ x: SHIP_PLACEMENT.x, z: SHIP_PLACEMENT.z })
    || corners.some((corner) => isInsideTrackPolygon(corner))) {
    problems.push('ship footprint intersects the Circuit 3 track polygon');
  }
  if (trackClearance < MIN_TRACK_CLEARANCE) problems.push(`only ${trackClearance.toFixed(2)} m from the track centreline`);
  if (nearestVessel && nearestVessel.clearance < MIN_SAFE_CLEARANCE) {
    problems.push(`only ${nearestVessel.clearance.toFixed(2)} m from vessel ${nearestVessel.id}`);
  }
  if (wheelClearance < MIN_SAFE_CLEARANCE) problems.push(`only ${wheelClearance.toFixed(2)} m from the Ferris wheel safety envelope`);

  return {
    valid: problems.length === 0,
    problems,
    trackCentrelineClearance: trackClearance,
    nearestVessel: nearestVessel?.id ?? null,
    nearestVesselClearance: nearestVessel?.clearance ?? null,
    ferrisWheelEnvelopeClearance: wheelClearance,
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

/** A single high-detail Dutch sailing ship floating only in Marina Bay (C3). */
export class SingaporeDutchShip {
  readonly root = new THREE.Group();
  readonly diagnostics = {
    source: MODEL_URL,
    circuit: 'singapore_marina',
    placement: { ...SHIP_PLACEMENT },
    loaded: false,
    loadState: 'loading' as 'loading' | 'loaded' | 'error' | 'disposed',
    meshCount: 0,
    triangles: 0,
    modelSize: [0, 0, 0] as [number, number, number],
    placementValidation: validatePlacement(),
    materials: ['glTF PBR hull', 'glTF PBR rigging', 'masked glTF PBR sails'],
    extraLights: 0,
    extraReflectionCameras: 0,
    castsShadow: false,
    flotation: 'samples the existing C3 ocean vertex grid and wave profile',
  };

  private readonly oceanGrid: MarineOceanGrid;
  private readonly seaLevel: number;
  private readonly modelLoader = new GLTFLoader();
  private readonly modelOffset = new THREE.Group();
  private modelScene: THREE.Object3D | null = null;
  private time = 0;
  private waveStrength = 0.84;
  private heave = 0;
  private pitch = 0;
  private roll = 0;
  private disposed = false;

  constructor(seaLevel: number, oceanGrid: MarineOceanGrid, maxAnisotropy = 8) {
    if (!this.diagnostics.placementValidation.valid) {
      throw new Error(`Unsafe C3 Dutch ship layout: ${this.diagnostics.placementValidation.problems.join('; ')}`);
    }

    this.seaLevel = seaLevel;
    this.oceanGrid = { ...oceanGrid };
    this.root.name = 'C3_DutchSailingShip';
    this.root.userData.c3DutchShip = this.diagnostics;
    this.root.position.set(SHIP_PLACEMENT.x, seaLevel, SHIP_PLACEMENT.z);
    this.root.add(this.modelOffset);
    void this.loadModel(maxAnisotropy);
    this.applyOceanPose(0, true);
  }

  update(dt: number, oceanTime?: number, waveStrength = this.waveStrength): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.time = Number.isFinite(oceanTime) ? oceanTime! : this.time + Math.min(dt, 0.1);
    this.waveStrength = Number.isFinite(waveStrength) ? waveStrength : this.waveStrength;
    this.applyOceanPose(Math.min(dt, 0.1), false);
  }

  private async loadModel(maxAnisotropy: number): Promise<void> {
    try {
      const gltf = await this.modelLoader.loadAsync(MODEL_URL);
      if (this.disposed) {
        disposeLoadedScene(gltf.scene);
        return;
      }

      const model = gltf.scene;
      model.name = 'C3_DutchSailingShip_GLTF';
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) throw new Error('The Dutch ship GLTF has no renderable bounds');
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      this.modelOffset.position.set(-center.x, -bounds.min.y - 0.06, -center.z);
      this.modelOffset.add(model);
      this.modelScene = model;

      let meshCount = 0;
      let triangles = 0;
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshCount++;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3;
        object.castShadow = false;
        object.receiveShadow = false;
        object.userData.c3NoShadow = true;
        // The existing C3 mirror pass renders layer 1; retain that participation.
        object.layers.enable(1);

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) {
              value.anisotropy = Math.max(1, Math.min(maxAnisotropy, value.anisotropy || 1));
            }
          }
        }
      });

      this.diagnostics.loaded = true;
      this.diagnostics.loadState = 'loaded';
      this.diagnostics.meshCount = meshCount;
      this.diagnostics.triangles = triangles;
      this.diagnostics.modelSize = [size.x, size.y, size.z];
      this.root.userData.c3DutchShip = this.diagnostics;
      this.applyOceanPose(0, true);
    } catch (error) {
      if (this.disposed) return;
      this.diagnostics.loadState = 'error';
      this.root.userData.c3DutchShip = this.diagnostics;
      console.warn('[Circuit 3] No se pudo cargar el velero Dutch Ship:', error);
    }
  }

  private applyOceanPose(dt: number, immediate: boolean): void {
    const yaw = SHIP_PLACEMENT.yaw;
    const headingX = Math.cos(yaw);
    const headingZ = -Math.sin(yaw);
    const beamX = Math.sin(yaw);
    const beamZ = Math.cos(yaw);
    const p = SHIP_PLACEMENT;
    const sample = (x: number, z: number) => sampleC3RenderedMarineWave(
      x, z, this.time, this.waveStrength, this.oceanGrid,
    );
    const centre = sample(p.x, p.z);
    const bow = sample(p.x + headingX * SHIP_WAVE_HALF_LENGTH, p.z + headingZ * SHIP_WAVE_HALF_LENGTH);
    const stern = sample(p.x - headingX * SHIP_WAVE_HALF_LENGTH, p.z - headingZ * SHIP_WAVE_HALF_LENGTH);
    const starboard = sample(p.x + beamX * SHIP_WAVE_HALF_BEAM, p.z + beamZ * SHIP_WAVE_HALF_BEAM);
    const port = sample(p.x - beamX * SHIP_WAVE_HALF_BEAM, p.z - beamZ * SHIP_WAVE_HALF_BEAM);
    const targetHeave = centre * 0.5 + (bow + stern) * 0.25;
    const targetPitch = THREE.MathUtils.clamp(Math.atan2(bow - stern, SHIP_WAVE_HALF_LENGTH * 2), -0.035, 0.035);
    const targetRoll = THREE.MathUtils.clamp(Math.atan2(port - starboard, SHIP_WAVE_HALF_BEAM * 2), -0.08, 0.08);
    const blend = immediate ? 1 : 1 - Math.exp(-dt * 2.8);

    this.heave += (targetHeave - this.heave) * blend;
    this.pitch += (targetPitch - this.pitch) * blend;
    this.roll += (targetRoll - this.roll) * blend;
    this.root.position.set(p.x, this.seaLevel + this.heave, p.z);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(this.roll, yaw, this.pitch, 'YXZ');
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
