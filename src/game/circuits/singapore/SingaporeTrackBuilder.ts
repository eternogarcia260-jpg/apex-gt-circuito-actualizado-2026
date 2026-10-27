/**
 * SingaporeTrackBuilder.ts — procedural Marina Bay-inspired night circuit.
 *
 * Closed 19-turn route, shared barrier/collision geometry, and bounded landmark LODs.
 * Visual references guide the landmarks; this is not surveyed FIA planimetry,
 * certification, a zero-bug guarantee, or a device-performance claim.
 * The host project supplies THREE, race logic, lighting and physics integration.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cloneC3AsphaltMap, finishC3AsphaltSurface, finishC3RubberSurface, loadC3AsphaltPBRMaps } from './SingaporeAsphaltSurface';
import asphaltImg from '../../../assets/images/track_asphalt_detail_1790904767865.jpg';
import c3RoadAsphaltAlbedo from '../../../assets/textures/c3-asphalt/aerial_asphalt_01_diff_1k.jpg';
import c3RoadAsphaltNormal from '../../../assets/textures/c3-asphalt/aerial_asphalt_01_nor_gl_1k.jpg';
import c3RoadAsphaltRoughness from '../../../assets/textures/c3-asphalt/aerial_asphalt_01_rough_1k.jpg';
import c3WallAsphaltAlbedo from '../../../assets/textures/c3-asphalt/asphalt_02_diff_2k.jpg';
import c3WallAsphaltNormal from '../../../assets/textures/c3-asphalt/asphalt_02_nor_gl_2k.jpg';
import c3WallAsphaltRoughness from '../../../assets/textures/c3-asphalt/asphalt_02_rough_2k.jpg';
import { getAsphaltPBRTextures, getConcretePBRTextures } from '../../utils/TrackPBRTextures';
import { ITrackWorld } from '../ICircuit';
import { StaticObstacle, DynamicProp } from '../../world/TrackBuilder';
import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';
import { GrandstandCrowdSystem } from '../../crowd/GrandstandCrowdSystem';
import { buildC3SafetyStrip, getC3TrackFrames } from './SingaporeSafetyGeometry';
import { buildC3KerbRibbons } from './SingaporeKerbGeometry';
import { buildC3FloodlightRig, createC3FloodlightSteelMaterial } from './SingaporeFloodlightDesign';
import { SingaporeCinematicAtmosphere } from './SingaporeCinematicAtmosphere';
import { createC3WaterSurface, type C3WaterSurface } from './SingaporeWaterSurface';
import { CurvedPitBuildingBuilder } from '../../world/CurvedPitBuildingBuilder';
import { createSingaporeMaritimeFleet, type SingaporeMaritimeFleet } from './SingaporeMaritimeFleet';
import { SingaporeFerrisWheel } from './SingaporeFerrisWheel';
import { SingaporeDutchShip } from './SingaporeDutchShip';
import { SingaporeGothicStatue } from './SingaporeGothicStatue';
import { SINGAPORE_TRACK_SURFACE_Y } from './SingaporeTrackSurface';
const _shadowCenterWorld = new THREE.Vector3();
const _shadowSphere = new THREE.Sphere();

/** Retile a BoxGeometry's existing UVs by physical face dimensions; positions stay untouched. */
function tileC3BoxGeometryUvs(geometry: THREE.BufferGeometry, metersPerTile = 3): void {
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  if (!positions || !uvs || metersPerTile <= 0 || positions.count % 4 !== 0) return;
  const component = (index: number, axis: number): number =>
    axis === 0 ? positions.getX(index) : axis === 1 ? positions.getY(index) : positions.getZ(index);

  for (let base = 0; base < positions.count; base += 4) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = base; i < base + 4; i++) for (let axis = 0; axis < 3; axis++) {
      const value = component(i, axis);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
    const axes = [0, 1, 2].sort((a, b) => (max[b] - min[b]) - (max[a] - min[a]));
    const uAxis = axes[0], vAxis = axes[1];
    for (let i = base; i < base + 4; i++) {
      uvs.setXY(i, (component(i, uAxis) - min[uAxis]) / metersPerTile,
        (component(i, vAxis) - min[vAxis]) / metersPerTile);
    }
  }
  uvs.needsUpdate = true;
}

export class SingaporeTrackBuilder implements ITrackWorld {
  public group: THREE.Group;
  public staticObstacles: StaticObstacle[] = [];
  public dynamicProps: DynamicProp[] = [];
  public crowdSystem: GrandstandCrowdSystem;
  private shadowCasterMeshes: THREE.Mesh[] = [];

  // Track Dimensions (Official F1 Urban standard width: 14m)
  public readonly trackWidth = 14.0;
  public readonly halfWidth = 7.0;

  // Pit Stop Area Bounds along canonical main straight (X ≈ 698 to 726, Z from -180 to 20)
  public readonly pitZone = {
    minX: 697.0,
    maxX: 728.0,
    minZ: -185.0,
    maxZ: 25.0,
  };

  // Materials
  private asphaltMat!: THREE.MeshStandardMaterial;
  private rubberGrooveMat!: THREE.MeshStandardMaterial;
  private kerbBlueMat!: THREE.MeshStandardMaterial;
  private kerbWhiteMat!: THREE.MeshStandardMaterial;
  private concreteBarrierMat!: THREE.MeshStandardMaterial;
  private safetyWallMat!: THREE.MeshStandardMaterial;
  private asphaltWallMat!: THREE.MeshStandardMaterial;
  private metalDarkMat!: THREE.MeshStandardMaterial;
  private metalSilverMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshStandardMaterial;
  private waterSurface?: C3WaterSurface;
  private waterMesh?: THREE.Mesh;
  private waterMat!: THREE.MeshStandardMaterial;
  private maritimeFleet?: SingaporeMaritimeFleet;
  private ferrisWheel?: SingaporeFerrisWheel;
  private dutchShip?: SingaporeDutchShip;
  private gothicStatue?: SingaporeGothicStatue;
  private whiteLineMat!: THREE.MeshStandardMaterial;
  private yellowLineMat!: THREE.MeshStandardMaterial;
  private floodlightPoleMat!: THREE.MeshStandardMaterial;
  private mbsBuildingMat!: THREE.MeshStandardMaterial;
  private mbsGlassMat!: THREE.MeshStandardMaterial;
  private mbsWindowPatternMat!: THREE.MeshStandardMaterial;
  private esplanadeDomeMat!: THREE.MeshStandardMaterial;
  private esplanadeGlowMat!: THREE.MeshStandardMaterial;
  private neonGlowCyanMat!: THREE.MeshStandardMaterial;
  private neonGlowMagentaMat!: THREE.MeshStandardMaterial;
  private sponsorSgMat!: THREE.MeshStandardMaterial;
  private sponsorRolexMat!: THREE.MeshStandardMaterial;
  private sponsorAirlinesMat!: THREE.MeshStandardMaterial;
  private bridgeTrussMat!: THREE.MeshStandardMaterial;
  private bridgeLanternMat!: THREE.MeshStandardMaterial;
  private skyscraperFacadeMat!: THREE.MeshStandardMaterial;

  // Dynamic animation objects
  private ferrisWheelRimGroup?: THREE.Group;
  private cinematicAtmosphere?: SingaporeCinematicAtmosphere;
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.crowdSystem = new GrandstandCrowdSystem();

    this.initMaterials();
    this.buildMarinaBayWater();
    this.buildRoadbedFoundation();
    this.buildTrackRibbon();
    this.buildRubberRacingGroove();
    this.buildSingaporeRibbonKerbs();
    this.buildRoadMarkings();
    this.buildStartFinishGantry();
    this.buildPitLaneAndGarages();
    this.buildDoubleSidedSafetyBarriers();
    this.buildPitAccessPerimeterWalls();
    this.buildInstancedStadiumFloodlights();
    this.buildBrakingDistanceBoards();
    this.upgradeWaterSurface();

    // Optimize static nodes for zero CPU matrix overhead
    const dynamicMeshes = new Set(this.dynamicProps.map((p) => p.mesh));
    if (this.ferrisWheelRimGroup) dynamicMeshes.add(this.ferrisWheelRimGroup);
    this.group.traverse((obj) => {
      let isDynamic = false;
      let shadowlessAncestor = false;
      let curr: THREE.Object3D | null = obj;
      while (curr && curr !== this.group) {
        if (dynamicMeshes.has(curr as any)) {
          isDynamic = true;
        }
        if (curr.userData.c3NoShadow) shadowlessAncestor = true;
        curr = curr.parent;
      }

      if (obj instanceof THREE.Mesh) {
        obj.castShadow = !shadowlessAncestor && !obj.userData.c3NoShadow &&
          !obj.name.startsWith('C3_UrbanGround') && obj.name !== 'C3_DistantCityBlocks';
        obj.receiveShadow = true;
        if (!isDynamic) {
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
        }
      }
    });
    this.group.updateMatrixWorld(true);

    this.shadowCasterMeshes = [];
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !obj.userData.c3NoShadow) {
        if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
        this.shadowCasterMeshes.push(obj);
      }
    });

    this.cinematicAtmosphere = new SingaporeCinematicAtmosphere(this.group, quality => {
      const material = this.waterSurface?.mesh.material as THREE.ShaderMaterial | undefined;
      material?.userData.setQuality?.(quality);
      if (this.waterSurface) this.waterSurface.mesh.userData.c3Frame = (this.waterSurface.mesh.userData.c3Frame ?? 0) + 1;
    });
    this.group.userData.c3Cinematic = this.cinematicAtmosphere.diagnostics;

    // Add new effect resources AFTER the approved procedural environment so
    // UUID allocation cannot perturb the original crowd / atmosphere seeds.
    // The boats have their own dynamic poses; do not freeze their radar rigs
    // in the static-node traversal above or override original shadow flags.
    const oceanGeometry = this.waterMesh!.geometry as THREE.PlaneGeometry;
    const oceanGrid = {
      width: oceanGeometry.parameters.width, depth: oceanGeometry.parameters.height,
      segmentsX: oceanGeometry.parameters.widthSegments, segmentsZ: oceanGeometry.parameters.heightSegments,
    };
    this.maritimeFleet = createSingaporeMaritimeFleet(this.waterMesh!.position.y, oceanGrid);
    this.group.add(this.maritimeFleet.root);
    this.maritimeFleet.root.updateMatrixWorld(true);
    this.maritimeFleet.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.castShadow && !object.userData.c3NoShadow) this.shadowCasterMeshes.push(object);
    });
    this.group.userData.c3Maritime = this.maritimeFleet.diagnostics;

    // Preserve the complete supplied model and its own moving-parent matrices,
    // shadow flags and cabin batches; do not pass it through the static sweep.
    // Appending it after the fleet also preserves all approved construction seeds.
    this.ferrisWheel = new SingaporeFerrisWheel(this.waterMesh!.position.y);
    this.group.add(this.ferrisWheel.root);
    this.ferrisWheel.root.updateMatrixWorld(true);
    this.ferrisWheel.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.castShadow && !object.userData.c3NoShadow) this.shadowCasterMeshes.push(object);
    });
    this.group.userData.c3FerrisWheel = this.ferrisWheel.diagnostics;

    // C3-only imported hero vessel. Keep it after the established fleet and wheel
    // so their construction order, procedural seeds and shadow setup stay intact.
    this.dutchShip = new SingaporeDutchShip(this.waterMesh!.position.y, oceanGrid);
    this.group.add(this.dutchShip.root);
    this.group.userData.c3DutchShip = this.dutchShip.diagnostics;

    // C3-only imported Gothic statue. It is appended after the established
    // scenery and never participates in the seeded/static construction sweep.
    this.gothicStatue = new SingaporeGothicStatue(meshes => {
      for (const mesh of meshes) this.shadowCasterMeshes.push(mesh);
    });
    this.group.add(this.gothicStatue.root);
    this.group.userData.c3GothicStatue = this.gothicStatue.diagnostics;
  }

  private initMaterials(): void {
    const asphaltPBR = getAsphaltPBRTextures();
    const asphaltAlbedo = asphaltPBR.albedo ? cloneC3AsphaltMap(asphaltPBR.albedo) : new THREE.TextureLoader().load(asphaltImg);
    asphaltAlbedo.wrapS = asphaltAlbedo.wrapT = THREE.RepeatWrapping;
    asphaltAlbedo.colorSpace = THREE.SRGBColorSpace;
    asphaltAlbedo.repeat.set(28, 28);
    asphaltAlbedo.anisotropy = 8;

    const asphaltNormal = cloneC3AsphaltMap(asphaltPBR.normal);
    asphaltNormal.repeat.set(28, 28);
    asphaltNormal.anisotropy = 4;

    const asphaltRough = cloneC3AsphaltMap(asphaltPBR.roughness);
    asphaltRough.repeat.set(28, 28);

    // Dry aggregate is dielectric. Suppress the former metallic, near-mirror
    // response and subpixel normal sparkle without changing the shared renderer.
    this.asphaltMat = new THREE.MeshPhysicalMaterial({
      name: 'C3_DryAggregateAsphalt',
      map: asphaltAlbedo,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: asphaltRough,
      color: 0x889096,
      roughness: 0.95,
      metalness: 0.0,
    });

    finishC3AsphaltSurface(this.asphaltMat);
    loadC3AsphaltPBRMaps(this.asphaltMat, {
      albedo: c3RoadAsphaltAlbedo,
      normal: c3RoadAsphaltNormal,
      roughness: c3RoadAsphaltRoughness,
    }, () => this.disposed, {
      label: 'aerial_asphalt_01_1k',
      repeat: [2, 2],
      normalScale: 0.85,
    });

    // 2. High-contrast rubber groove
    this.rubberGrooveMat = new THREE.MeshStandardMaterial({
      name: 'C3_RubberedRacingLine',
      color: 0x15191d,
      roughness: 0.72,
      metalness: 0.0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    finishC3RubberSurface(this.rubberGrooveMat);

    // 3. Official Marina Bay blue & white curbs
    this.kerbBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0055b8, // Singapore Grand Prix royal blue
      roughness: 0.78,
      metalness: 0.0,
    });

    this.kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      roughness: 0.78,
      metalness: 0.0,
    });

    // 4. Concrete barrier
    this.concreteBarrierMat = new THREE.MeshStandardMaterial({
      color: 0xa2a7ad,
      roughness: 0.94,
      metalness: 0.0,
    });
    const concretePBR = getConcretePBRTextures();
    this.safetyWallMat = this.concreteBarrierMat.clone();
    this.safetyWallMat.name = 'C3_PrecastConcreteWalls';
    this.safetyWallMat.color.set(0xffffff);
    if (concretePBR.albedo) {
      // The shared map is calibrated for dark sunlit concrete. A brighter
      // instance-owned canvas represents pale precast race barriers at night.
      const source = concretePBR.albedo.image as HTMLCanvasElement;
      const canvas = document.createElement('canvas');
      canvas.width = source.width;canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = 'brightness(1.7)';ctx.drawImage(source, 0, 0);
      this.safetyWallMat.map = new THREE.CanvasTexture(canvas);
      this.safetyWallMat.map.colorSpace = THREE.SRGBColorSpace;
      this.safetyWallMat.map.wrapS = this.safetyWallMat.map.wrapT = THREE.RepeatWrapping;
      this.safetyWallMat.map.anisotropy = 4;
    }
    this.safetyWallMat.normalMap = concretePBR.normal.clone();
    this.safetyWallMat.roughnessMap = concretePBR.roughness.clone();
    this.safetyWallMat.normalScale.set(0.14, 0.14);

    // Track and pit safety barriers use the asphalt set that was previously on the road.
    // Keep the separate concrete material for the garage architecture and quay structure.
    this.asphaltWallMat = new THREE.MeshStandardMaterial({
      name: 'C3_AsphaltPBRSafetyWalls',
      color: 0xa2a7ad,
      roughness: 0.96,
      metalness: 0,
    });
    loadC3AsphaltPBRMaps(this.asphaltWallMat, {
      albedo: c3WallAsphaltAlbedo,
      normal: c3WallAsphaltNormal,
      roughness: c3WallAsphaltRoughness,
    }, () => this.disposed, {
      label: 'asphalt_02_2k_walls',
      repeat: [1, 1],
      normalScale: 0.45,
    });

    // SkyPark's elevated pool remains independent from the sea-level planar reflection.
    this.waterMat = new THREE.MeshStandardMaterial({ name: 'C3_SkyParkPoolWater', color: 0x0b171b, roughness: 0.36, metalness: 0 });

    // 6. Crisp track markings
    this.whiteLineMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.82,
      metalness: 0.0,
    });

    this.yellowLineMat = new THREE.MeshStandardMaterial({
      color: 0xffd200,
      roughness: 0.35,
      metalness: 0.1,
    });

    // PBR materials for Circuit 1 aerodynamic garages and paddock architecture
    this.metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.40,
      metalness: 0.82,
    });

    this.metalSilverMat = new THREE.MeshStandardMaterial({
      color: 0xd2d9e2,
      roughness: 0.28,
      metalness: 0.90,
    });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x0e1724,
      roughness: 0.12,
      metalness: 0.90,
      transparent: true,
      opacity: 0.85,
    });

    // 7. Floodlight structures — shared textured PBR finish for every mast, boom and case.
    this.floodlightPoleMat = createC3FloodlightSteelMaterial();

    // 8. Landmarks
    this.mbsBuildingMat = new THREE.MeshStandardMaterial({
      color: 0xdde3ea,
      roughness: 0.45,
      metalness: 0.25,
    });

    this.mbsGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f2b48,
      roughness: 0.12,
      metalness: 0.85,
      emissive: 0x0a1e36,
      emissiveIntensity: 0.65,
    });

    this.mbsWindowPatternMat = new THREE.MeshStandardMaterial({
      color: 0x1a2634,
      emissive: 0x253b52,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.4,
    });

    this.esplanadeDomeMat = new THREE.MeshStandardMaterial({
      name: 'C3_EsplanadeAluminiumSunshades',
      color: 0xb9ad96,
      roughness: 0.68,
      metalness: 0.65,
    });

    this.esplanadeGlowMat = new THREE.MeshStandardMaterial({
      name: 'C3_EsplanadeRecessedGlazing',
      color: 0x222b31,
      emissive: 0x5c4020,
      emissiveIntensity: 0.3,
      roughness: 0.34,
      metalness: 0.05,
    });

    this.neonGlowCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00c8e0,
      emissiveIntensity: 2.8,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.neonGlowMagentaMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      emissive: 0xe6005c,
      emissiveIntensity: 2.6,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.sponsorSgMat = new THREE.MeshStandardMaterial({
      color: 0xe60000,
      emissive: 0x660000,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.1,
    });

    this.sponsorRolexMat = new THREE.MeshStandardMaterial({
      color: 0x006039,
      emissive: 0x002c1a,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.3,
    });

    this.sponsorAirlinesMat = new THREE.MeshStandardMaterial({
      color: 0x162b4d,
      emissive: 0x0d1a2e,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.1,
    });

    this.bridgeTrussMat = new THREE.MeshStandardMaterial({
      color: 0xadb7be,
      roughness: 0.65,
      metalness: 0,
    });
    this.bridgeTrussMat.name = 'C3_AndersonPaintedSteel';

    this.bridgeLanternMat = new THREE.MeshStandardMaterial({
      color: 0xfffaed,
      emissive: 0xffb84d,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.skyscraperFacadeMat = new THREE.MeshStandardMaterial({
      color: 0x121b28,
      emissive: 0x1e2e42,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
  }

  private buildMarinaBayWater(): void {
    // Continuous deep-water plane beneath and around the entire floating route.
    const waterGeo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
    // Construct the original placeholder before procedural scenery. Three UUIDs
    // consume Math.random, so new effect resources must come AFTER the crowd.
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh = waterMesh;
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, -1.25, 0);
    this.group.add(waterMesh);
  }

  private upgradeWaterSurface(): void {
    const original = this.waterMesh!;
    const index = this.group.children.indexOf(original);
    this.waterSurface = createC3WaterSurface(original.geometry);
    const originalMaterials = Array.isArray(original.material) ? original.material : [original.material];
    originalMaterials.forEach((material) => material.dispose());
    const water = this.waterSurface.mesh;
    water.position.copy(original.position);
    water.rotation.x = -Math.PI / 2;
    water.userData.c3NoShadow = true;
    this.group.remove(original); this.group.add(water);
    // Preserve the approved child order. Only water geometry changes under the explicit depth exception.
    this.group.children.splice(this.group.children.indexOf(water), 1);
    this.group.children.splice(index, 0, water);
    this.waterMesh = water;
    this.group.userData.c3Ocean = {
      seaLevel: water.position.y,
      width: 1900,
      depth: 1500,
      trackSurfaceY: SINGAPORE_TRACK_SURFACE_Y,
      clearanceBelowTrack: SINGAPORE_TRACK_SURFACE_Y - water.position.y,
      continuous: true,
      visualMarginMetres: 100,
    };
    this.group.userData.c3Water = this.waterSurface.diagnostics;
  }

  private buildTrackRibbon(): void {
    const pts = SINGAPORE_WAYPOINTS;
    const numPts = pts.length;

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfW = this.halfWidth;
    const last = pts[numPts - 1], first = pts[0];
    const lapLength = (last.accumulatedDistance ?? (numPts - 1) * 7.5) + Math.hypot(last.x - first.x, last.z - first.z);
    // An integer lap UV closes phase exactly with the shared integer-repeat maps.
    // The 0.0406% density adjustment avoids a fractional texture jump at WP0.
    const lapV = Math.max(1, Math.round(lapLength * 0.08));
    const uvPerMetre = lapV / lapLength;

    // Duplicate the first pair only for the closing UV edge, not its faces.
    for (let i = 0; i <= numPts; i++) {
      const pointIndex = i % numPts;
      const p = pts[pointIndex];
      const prevP = pts[(pointIndex - 1 + numPts) % numPts];
      const nextP = pts[(pointIndex + 1) % numPts];

      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      const normX = -dz / len;
      const normZ = dx / len;

      const dist = i === numPts ? lapV : (p.accumulatedDistance ?? i * 7.5) * uvPerMetre;
      vertices.push(p.x - normX * halfW, SINGAPORE_TRACK_SURFACE_Y, p.z - normZ * halfW);
      uvs.push(0, dist);

      vertices.push(p.x + normX * halfW, SINGAPORE_TRACK_SURFACE_Y, p.z + normZ * halfW);
      uvs.push(1, dist);

      if (i < numPts) {
        const currentLeft = i * 2;
        const currentRight = i * 2 + 1;
        const nextLeft = (i + 1) * 2;
        const nextRight = (i + 1) * 2 + 1;

        indices.push(currentLeft, currentRight, nextLeft);
        indices.push(currentRight, nextRight, nextLeft);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, this.asphaltMat);
    roadMesh.name = 'C3_MainAsphalt';
    roadMesh.userData.c3NoShadow = true;
    this.group.add(roadMesh);
  }

  /**
   * Slightly oversized structural pavement below the visible ribbon.
   * It seals the acute-corner seams between waypoint quads without changing
   * the racing surface, kerbs, UVs or collision line. This is deliberately a
   * single static mesh so it costs one draw call and prevents the ocean from
   * showing through at every tight turn.
   */
  private buildRoadbedFoundation(): void {
    const pts = SINGAPORE_WAYPOINTS;
    // Width 12.5m comfortably encloses safety walls (8.9m) and high-mast stadium floodlights (10.7m),
    // eliminating any floating structures or see-through gaps along the entire 4,927m circuit.
    const halfW = 12.5;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const numPts = pts.length;

    // 1. Structural horizontal roadbed quad ribbon
    for (let i = 0; i < numPts; i++) {
      const p = pts[i];
      const prev = pts[(i - 1 + numPts) % numPts];
      const next = pts[(i + 1) % numPts];
      const dx = next.x - prev.x, dz = next.z - prev.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length;
      vertices.push(p.x - nx * halfW, -0.02, p.z - nz * halfW);
      uvs.push(0, (p.accumulatedDistance ?? i * 7.5) * 0.08);
      vertices.push(p.x + nx * halfW, -0.02, p.z + nz * halfW);
      uvs.push(1, (p.accumulatedDistance ?? i * 7.5) * 0.08);
      const j = (i + 1) % numPts;
      indices.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
    }

    // 2. Deep vertical concrete foundation barrier down to Y = -2.60m along both outer margins
    // Guarantees zero see-through artifacts or water intrusion underneath the asphalt from any camera angle
    const skirtBaseIndex = vertices.length / 3;
    for (let i = 0; i < numPts; i++) {
      const p = pts[i];
      const prev = pts[(i - 1 + numPts) % numPts];
      const next = pts[(i + 1) % numPts];
      const dx = next.x - prev.x, dz = next.z - prev.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length;

      // Outer left edge top and bottom
      const olx = p.x - nx * halfW, olz = p.z - nz * halfW;
      vertices.push(olx, -0.02, olz);
      uvs.push(0, i * 0.1);
      vertices.push(olx, -2.60, olz);
      uvs.push(1, i * 0.1);

      // Outer right edge top and bottom
      const orx = p.x + nx * halfW, orz = p.z + nz * halfW;
      vertices.push(orx, -0.02, orz);
      uvs.push(0, i * 0.1);
      vertices.push(orx, -2.60, orz);
      uvs.push(1, i * 0.1);

      const j = (i + 1) % numPts;
      const leftTop1 = skirtBaseIndex + i * 4;
      const leftBot1 = leftTop1 + 1;
      const rightTop1 = leftTop1 + 2;
      const rightBot1 = leftTop1 + 3;

      const leftTop2 = skirtBaseIndex + j * 4;
      const leftBot2 = leftTop2 + 1;
      const rightTop2 = leftTop2 + 2;
      const rightBot2 = leftTop2 + 3;

      // Left skirt quad
      indices.push(leftTop1, leftBot1, leftTop2, leftBot1, leftBot2, leftTop2);
      // Right skirt quad
      indices.push(rightTop1, rightTop2, rightBot1, rightTop2, rightBot2, rightBot1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const roadbed = new THREE.Mesh(geometry, this.asphaltMat);
    roadbed.name = 'C3_ContinuousRoadbed';
    roadbed.userData.c3NoShadow = true;
    this.group.add(roadbed);
  }

  private buildRubberRacingGroove(): void {
    const pts = SINGAPORE_WAYPOINTS;
    const numPts = pts.length;
    const grooveWidth = 3.6;

    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const p = pts[i];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const nextP = pts[(i + 1) % numPts];

      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      const normX = -dz / len;
      const normZ = dx / len;

      vertices.push(p.x - normX * grooveWidth, 0.025, p.z - normZ * grooveWidth);
      vertices.push(p.x + normX * grooveWidth, 0.025, p.z + normZ * grooveWidth);

      const currentLeft = i * 2;
      const currentRight = i * 2 + 1;
      const nextLeft = ((i + 1) % numPts) * 2;
      const nextRight = ((i + 1) % numPts) * 2 + 1;

      indices.push(currentLeft, currentRight, nextLeft);
      indices.push(currentRight, nextRight, nextLeft);
    }

    const grooveGeo = new THREE.BufferGeometry();
    grooveGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    grooveGeo.setIndex(indices);
    grooveGeo.computeVertexNormals();

    const grooveMesh = new THREE.Mesh(grooveGeo, this.rubberGrooveMat);
    grooveMesh.name = 'C3_RubberGroove';
    grooveMesh.userData.c3NoShadow = true;
    this.group.add(grooveMesh);
  }

  private buildSingaporeRibbonKerbs(): void {
    const ribbons = buildC3KerbRibbons(SINGAPORE_WAYPOINTS, this.halfWidth);
    const blue = new THREE.Mesh(ribbons.blue, this.kerbBlueMat);
    const white = new THREE.Mesh(ribbons.white, this.kerbWhiteMat);
    blue.name = 'C3_KerbsBlue';white.name = 'C3_KerbsWhite';
    this.group.add(blue, white);
    this.group.userData.c3KerbStats = ribbons.stats;
  }

  private buildRoadMarkings(): void {
    const pts = SINGAPORE_WAYPOINTS;
    const numPts = pts.length;
    const halfW = this.halfWidth - 0.25;

    const leftVertices: number[] = [];
    const rightVertices: number[] = [];
    const leftIndices: number[] = [];
    const rightIndices: number[] = [];

    const lineWidth = 0.10; // Half of a 20 cm stripe, wholly on the asphalt.

    for (let i = 0; i < numPts; i++) {
      const p = pts[i];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const nextP = pts[(i + 1) % numPts];

      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      const normX = -dz / len;
      const normZ = dx / len;

      const lx = p.x - normX * halfW;
      const lz = p.z - normZ * halfW;
      leftVertices.push(lx - normX * lineWidth, 0.026, lz - normZ * lineWidth);
      leftVertices.push(lx + normX * lineWidth, 0.026, lz + normZ * lineWidth);

      const rx = p.x + normX * halfW;
      const rz = p.z + normZ * halfW;
      rightVertices.push(rx - normX * lineWidth, 0.026, rz - normZ * lineWidth);
      rightVertices.push(rx + normX * lineWidth, 0.026, rz + normZ * lineWidth);

      const curL = i * 2;
      const curR = i * 2 + 1;
      const nxtL = ((i + 1) % numPts) * 2;
      const nxtR = ((i + 1) % numPts) * 2 + 1;

      leftIndices.push(curL, curR, nxtL, curR, nxtR, nxtL);
      rightIndices.push(curL, curR, nxtL, curR, nxtR, nxtL);
    }

    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftVertices, 3));
    leftGeo.setIndex(leftIndices);

    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightVertices, 3));
    rightGeo.setIndex(rightIndices);

    const mergedWhiteLines = BufferGeometryUtils.mergeGeometries([leftGeo, rightGeo]);
    leftGeo.dispose();
    rightGeo.dispose();
    if (mergedWhiteLines) {
      mergedWhiteLines.computeVertexNormals();
      const linesMesh = new THREE.Mesh(mergedWhiteLines, this.whiteLineMat);
      linesMesh.name = 'C3_MergedTrackEdgeLines';
      this.group.add(linesMesh);
    }
  }

  private buildStartFinishGantry(): void {
    const gantryGroup = new THREE.Group();
    // Exactly at Start / Finish line (X: 687.89, Z: -108.18)
    gantryGroup.position.set(687.89, 0, -108.18);
    gantryGroup.rotation.y = -2.996; // Aligned with the track heading

    const pylonGeo = new THREE.BoxGeometry(1.0, 9.5, 1.0);
    const pylonL = new THREE.Mesh(pylonGeo, this.floodlightPoleMat);
    pylonL.position.set(-9.5, 4.75, 0);
    const pylonR = new THREE.Mesh(pylonGeo, this.floodlightPoleMat);
    pylonR.position.set(9.5, 4.75, 0);
    gantryGroup.add(pylonL, pylonR);

    const trussGeo = new THREE.BoxGeometry(20.5, 1.4, 1.4);
    const truss = new THREE.Mesh(trussGeo, this.floodlightPoleMat);
    truss.position.set(0, 8.8, 0);
    gantryGroup.add(truss);

    const bannerGeo = new THREE.PlaneGeometry(16.5, 2.0);
    const banner = new THREE.Mesh(bannerGeo, this.sponsorSgMat);
    banner.position.set(0, 8.8, -0.75);
    banner.rotation.y = Math.PI;
    gantryGroup.add(banner);

    const rolexGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 24);
    const rolex = new THREE.Mesh(rolexGeo, this.sponsorRolexMat);
    rolex.rotation.x = Math.PI / 2;
    rolex.position.set(0, 10.4, 0);
    gantryGroup.add(rolex);

    const gridGeo = new THREE.PlaneGeometry(14.0, 2.2);
    const gridMesh = new THREE.Mesh(gridGeo, this.whiteLineMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(0, 0.035, 0);
    gantryGroup.add(gridMesh);

    this.group.add(gantryGroup);
  }

  private buildPitLaneAndGarages(): void {
    const pitGroup = new THREE.Group();
    pitGroup.name = 'C3_PitComplex';
    // Start / Finish Straight Origin (X: 687.89, Y: 0, Z: -108.18)
    // Rotation -2.996 aligns local +Z with racing direction and local -X with exterior paddock
    pitGroup.position.set(687.89, 0, -108.18);
    pitGroup.rotation.y = -2.996;

    // =========================================================================
    // 1. AERODYNAMIC F1 GARAGES & PADDOCK COMPLEX (Circuit 1 Architecture)
    // =========================================================================
    const curvedPaddock = CurvedPitBuildingBuilder.buildCurvedPitBuilding(
      {
        metalDarkMat: this.metalDarkMat,
        metalSilverMat: this.metalSilverMat,
        glassMat: this.glassMat,
        concreteMat: this.safetyWallMat,
      },
      96.0,
      { x: 0, y: 0, z: 0 }
    );

    const garageContainer = new THREE.Group();
    garageContainer.name = 'C3_PitGaragesExterior';
    // Positioned at X = -20.5 in local coordinates (exterior of circuit, world X ≈ 708 to 720)
    // Rotated -90° so garages face pit lane (+X) and building length runs along Z (-48 to +48)
    garageContainer.position.set(-20.5, 0, 0);
    garageContainer.rotation.y = -Math.PI / 2;
    garageContainer.add(curvedPaddock);
    pitGroup.add(garageContainer);

    // =========================================================================
    // 2. PIT WALL (Muro de Boxes) WITH FIA TELEMETRY PERCHES & NOSE ATTENUATORS
    // =========================================================================
    const pitWallLength = 150;
    const pitWallGeo = new THREE.BoxGeometry(0.9, 1.25, pitWallLength);
    tileC3BoxGeometryUvs(pitWallGeo);
    const pitWall = new THREE.Mesh(pitWallGeo, this.asphaltWallMat);
    pitWall.name = 'C3_PitWall';
    pitWall.position.set(-8.2, 0.625, 0);
    pitGroup.add(pitWall);

    // Pit wall catch fence (lightweight dark safety mesh on top)
    const fenceGeo = new THREE.PlaneGeometry(pitWallLength, 1.2);
    const fenceMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat);
    fenceMesh.rotation.y = Math.PI / 2;
    fenceMesh.position.set(-8.2, 1.85, 0);
    pitGroup.add(fenceMesh);

    // 6 Telemetry perches along pit wall (Trackside facing the straight)
    const perchGeo = new THREE.BoxGeometry(1.2, 2.2, 4.0);
    const monitorGeo = new THREE.BoxGeometry(0.18, 0.95, 3.4);
    const perchCount = 6;
    const perchInst = new THREE.InstancedMesh(perchGeo, this.floodlightPoleMat, perchCount);
    const monitorInst = new THREE.InstancedMesh(monitorGeo, this.neonGlowCyanMat, perchCount);
    perchInst.name = 'C3_PitPerchesInstanced';
    monitorInst.name = 'C3_PitMonitorsInstanced';

    const dummy = new THREE.Object3D();
    const perchZPositions = [-50, -30, -10, 10, 30, 50];
    perchZPositions.forEach((pz, idx) => {
      // Perch stand on pit wall
      dummy.position.set(-8.2, 1.35, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      perchInst.setMatrixAt(idx, dummy.matrix);

      // Dual telemetry screens facing track (+X)
      dummy.position.set(-7.55, 1.95, pz);
      dummy.updateMatrix();
      monitorInst.setMatrixAt(idx, dummy.matrix);
    });
    perchInst.instanceMatrix.needsUpdate = true;
    monitorInst.instanceMatrix.needsUpdate = true;
    pitGroup.add(perchInst, monitorInst);

    // Rounded Impact Attenuator crash cushions at both pit wall ends
    [-pitWallLength / 2, pitWallLength / 2].forEach((nz, i) => {
      const isEntry = i === 0;
      const noseGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 16, 1, false, 0, Math.PI);
      noseGeo.rotateY(isEntry ? -Math.PI / 2 : Math.PI / 2);
      const noseMesh = new THREE.Mesh(noseGeo, this.yellowLineMat);
      noseMesh.position.set(-8.2, 0.625, nz);
      pitGroup.add(noseMesh);

      // Flashing amber safety LED beacon on entry nose
      if (isEntry) {
        const beaconBaseGeo = new THREE.CylinderGeometry(0.16, 0.20, 0.35, 12);
        const beaconBase = new THREE.Mesh(beaconBaseGeo, this.floodlightPoleMat);
        beaconBase.position.set(-8.2, 1.42, nz);
        pitGroup.add(beaconBase);

        const beaconLightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12);
        const beaconLightMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xf59e0b,
          emissiveIntensity: 5.0,
          roughness: 0.1,
        });
        const beaconLight = new THREE.Mesh(beaconLightGeo, beaconLightMat);
        beaconLight.position.set(-8.2, 1.68, nz);
        pitGroup.add(beaconLight);
      }
    });

    // =========================================================================
    // 3. SOLID MARITIME QUAY PLATFORM & STREET ROADS
    // =========================================================================
    // Monolithic reinforced concrete quay platform extending beneath the entire pit complex,
    // from track edge (X = -7.0) to outer paddock boundary (X = -44.0), and from Z = -145 to Z = +145.
    // 3.5m deep solid seawall bulkhead completely seals the ground against sea water penetration.
    const quayW = 37.0;
    const quayL = 290.0;
    const quayGeo = new THREE.BoxGeometry(quayW, 3.5, quayL);
    const quayMesh = new THREE.Mesh(quayGeo, this.concreteBarrierMat);
    quayMesh.name = 'C3_PitPaddockMarineQuay';
    quayMesh.position.set(-7.0 - quayW / 2, -1.735, 0);
    quayMesh.receiveShadow = true;
    pitGroup.add(quayMesh);

    // A. Main Pit Lane Apron (X: -8.65 to -20.5, Z: -75 to +75, width 11.85m)
    const apronW = 11.85;
    const apronL = pitWallLength;
    const apronGeo = new THREE.PlaneGeometry(apronW, apronL);
    const apronUV = apronGeo.getAttribute('uv');
    for (let i = 0; i < apronUV.count; i++) {
      apronUV.setXY(i, (apronUV.getX(i) * apronW) / 14.0 * 28.0, apronUV.getY(i) * apronL * 0.08);
    }
    apronUV.needsUpdate = true;
    const apronMesh = new THREE.Mesh(apronGeo, this.asphaltMat);
    apronMesh.name = 'C3_PitApron';
    apronMesh.rotation.x = -Math.PI / 2;
    apronMesh.position.set(-8.65 - apronW / 2, 0.021, 0);
    pitGroup.add(apronMesh);

    // B. Pit Entry Deceleration Ramp (Z: -135 to -75)
    // Tapers smoothly from track right edge (X = -7.0) to full pit apron (X: -8.65 to -20.5)
    const entryVertices: number[] = [];
    const entryUVs: number[] = [];
    const entryIndices: number[] = [];
    const entrySteps = 12;
    for (let s = 0; s <= entrySteps; s++) {
      const t = s / entrySteps;
      const z = -135 + t * 60; // -135 -> -75
      const innerX = THREE.MathUtils.lerp(-7.0, -8.65, t);
      const outerX = THREE.MathUtils.lerp(-11.5, -20.5, t);
      entryVertices.push(innerX, 0.021, z);
      entryVertices.push(outerX, 0.021, z);
      entryUVs.push(0, t * 8);
      entryUVs.push(((outerX - innerX) / 14.0) * 28.0, t * 8);
      if (s < entrySteps) {
        const base = s * 2;
        entryIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const entryGeo = new THREE.BufferGeometry();
    entryGeo.setAttribute('position', new THREE.Float32BufferAttribute(entryVertices, 3));
    entryGeo.setAttribute('uv', new THREE.Float32BufferAttribute(entryUVs, 2));
    entryGeo.setIndex(entryIndices);
    entryGeo.computeVertexNormals();
    const entryMesh = new THREE.Mesh(entryGeo, this.asphaltMat);
    entryMesh.name = 'C3_PitEntryRamp';
    pitGroup.add(entryMesh);

    // C. Pit Exit Acceleration Ramp (Z: +75 to +135)
    // Merges smoothly from pit apron (X: -8.65 to -20.5) back to track edge (X: -7.0)
    const exitVertices: number[] = [];
    const exitUVs: number[] = [];
    const exitIndices: number[] = [];
    const exitSteps = 12;
    for (let s = 0; s <= exitSteps; s++) {
      const t = s / exitSteps;
      const z = 75 + t * 60; // +75 -> +135
      const innerX = THREE.MathUtils.lerp(-8.65, -7.0, t);
      const outerX = THREE.MathUtils.lerp(-20.5, -11.0, t);
      exitVertices.push(innerX, 0.021, z);
      exitVertices.push(outerX, 0.021, z);
      exitUVs.push(0, t * 8);
      exitUVs.push(((outerX - innerX) / 14.0) * 28.0, t * 8);
      if (s < exitSteps) {
        const base = s * 2;
        exitIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const exitGeo = new THREE.BufferGeometry();
    exitGeo.setAttribute('position', new THREE.Float32BufferAttribute(exitVertices, 3));
    exitGeo.setAttribute('uv', new THREE.Float32BufferAttribute(exitUVs, 2));
    exitGeo.setIndex(exitIndices);
    exitGeo.computeVertexNormals();
    const exitMesh = new THREE.Mesh(exitGeo, this.asphaltMat);
    exitMesh.name = 'C3_PitExitRamp';
    pitGroup.add(exitMesh);

    // D. Paddock Rear Service Alley (X: -20.5 to -39.0, Z: -135 to +135, width 18.5m)
    const serviceW = 18.5;
    const serviceL = 270;
    const serviceGeo = new THREE.PlaneGeometry(serviceW, serviceL);
    const serviceUV = serviceGeo.getAttribute('uv');
    for (let i = 0; i < serviceUV.count; i++) {
      serviceUV.setXY(i, (serviceUV.getX(i) * serviceW) / 14.0 * 28.0, serviceUV.getY(i) * serviceL * 0.08);
    }
    serviceUV.needsUpdate = true;
    const serviceMesh = new THREE.Mesh(serviceGeo, this.asphaltMat);
    serviceMesh.name = 'C3_PaddockServiceRoad';
    serviceMesh.rotation.x = -Math.PI / 2;
    serviceMesh.position.set(-20.5 - serviceW / 2, 0.019, 0);
    pitGroup.add(serviceMesh);

    // =========================================================================
    // 4. ROAD MARKINGS: SPEED LIMIT STENCIL, FAST LANE & PIT BOXES
    // =========================================================================
    // Fast Lane Continuous Yellow Line (X = -13.5)
    const fastLineGeo = new THREE.PlaneGeometry(0.16, pitWallLength - 10);
    const fastLineMesh = new THREE.Mesh(fastLineGeo, this.yellowLineMat);
    fastLineMesh.rotation.x = -Math.PI / 2;
    fastLineMesh.position.set(-13.5, 0.026, 0);
    pitGroup.add(fastLineMesh);

    // Pit Limiter Transverse Band & "PIT 60" Stencil (at Z = -65, X: -8.65 to -20.5)
    const limiterCanvas = document.createElement('canvas');
    limiterCanvas.width = 512;
    limiterCanvas.height = 128;
    const lCtx = limiterCanvas.getContext('2d')!;
    lCtx.clearRect(0, 0, 512, 128);
    // Red & white checkered threshold
    for (let x = 0; x < 512; x += 32) {
      lCtx.fillStyle = (x / 32) % 2 === 0 ? '#ef4444' : '#ffffff';
      lCtx.fillRect(x, 0, 32, 128);
    }
    // Dark central badge with "PIT 60"
    lCtx.fillStyle = '#0f172a';
    lCtx.fillRect(160, 20, 192, 88);
    lCtx.strokeStyle = '#facc15';
    lCtx.lineWidth = 4;
    lCtx.strokeRect(160, 20, 192, 88);
    lCtx.fillStyle = '#ffffff';
    lCtx.font = 'bold 44px monospace';
    lCtx.textAlign = 'center';
    lCtx.fillText('PIT 60', 256, 80);

    const limiterTex = new THREE.CanvasTexture(limiterCanvas);
    const limiterMat = new THREE.MeshStandardMaterial({
      map: limiterTex,
      transparent: true,
      roughness: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const limiterMesh = new THREE.Mesh(new THREE.PlaneGeometry(apronW, 1.8), limiterMat);
    limiterMesh.rotation.x = -Math.PI / 2;
    limiterMesh.position.set(-8.65 - apronW / 2, 0.027, -65);
    pitGroup.add(limiterMesh);

    // 5 Team Pit Stop Box Decals (X = -17.0, along pit lane apron)
    const pitBoxCanvas = document.createElement('canvas');
    pitBoxCanvas.width = 256;
    pitBoxCanvas.height = 256;
    const bCtx = pitBoxCanvas.getContext('2d')!;
    bCtx.clearRect(0, 0, 256, 256);
    bCtx.strokeStyle = '#facc15';
    bCtx.lineWidth = 14;
    // Outer alignment brackets
    bCtx.strokeRect(12, 12, 232, 232);
    // Central stop box
    bCtx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    bCtx.fillRect(60, 100, 136, 56);
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'bold 32px monospace';
    bCtx.textAlign = 'center';
    bCtx.fillText('STOP', 128, 140);

    const pitBoxTex = new THREE.CanvasTexture(pitBoxCanvas);
    const pitBoxMat = new THREE.MeshStandardMaterial({
      map: pitBoxTex,
      transparent: true,
      roughness: 0.60,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const boxGeo = new THREE.PlaneGeometry(3.6, 6.0);
    [-36, -18, 0, 18, 36].forEach((bz) => {
      const boxMesh = new THREE.Mesh(boxGeo, pitBoxMat);
      boxMesh.rotation.x = -Math.PI / 2;
      boxMesh.position.set(-17.0, 0.027, bz);
      pitGroup.add(boxMesh);
    });

    // Solid FIA White Pit Exit Acceleration Line (X = -7.0, Z: +75 to +140)
    const exitLineGeo = new THREE.PlaneGeometry(0.18, 65);
    const exitLineMesh = new THREE.Mesh(exitLineGeo, this.whiteLineMat);
    exitLineMesh.rotation.x = -Math.PI / 2;
    exitLineMesh.position.set(-7.0, 0.028, 107.5);
    pitGroup.add(exitLineMesh);

    // Divergence Gore Chevron Markings (Z: -95 to -75, between track and entry)
    const goreCanvas = document.createElement('canvas');
    goreCanvas.width = 128;
    goreCanvas.height = 256;
    const gCtx = goreCanvas.getContext('2d')!;
    gCtx.clearRect(0, 0, 128, 256);
    gCtx.fillStyle = '#f8fafc';
    for (let y = -64; y < 256; y += 48) {
      gCtx.beginPath();
      gCtx.moveTo(0, y);
      gCtx.lineTo(64, y + 32);
      gCtx.lineTo(128, y);
      gCtx.lineTo(128, y + 20);
      gCtx.lineTo(64, y + 52);
      gCtx.lineTo(0, y + 20);
      gCtx.closePath();
      gCtx.fill();
    }
    const goreTex = new THREE.CanvasTexture(goreCanvas);
    const goreMat = new THREE.MeshStandardMaterial({
      map: goreTex,
      transparent: true,
      roughness: 0.70,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const goreMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 18), goreMat);
    goreMesh.rotation.x = -Math.PI / 2;
    goreMesh.position.set(-7.6, 0.027, -85);
    pitGroup.add(goreMesh);

    // =========================================================================
    // 5. PHYSICAL STATIC OBSTACLES & COLLISION REGISTRATION
    // =========================================================================
    pitGroup.updateMatrixWorld(true);

    // Pit Wall collision segment
    const wallStartWorld = new THREE.Vector3(-8.2, 0, -pitWallLength / 2).applyMatrix4(pitGroup.matrixWorld);
    const wallEndWorld = new THREE.Vector3(-8.2, 0, pitWallLength / 2).applyMatrix4(pitGroup.matrixWorld);
    this.staticObstacles.push({
      x: (wallStartWorld.x + wallEndWorld.x) / 2,
      z: (wallStartWorld.z + wallEndWorld.z) / 2,
      radius: pitWallLength / 2 + 1.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: wallStartWorld.x, z: wallStartWorld.z },
      p2: { x: wallEndWorld.x, z: wallEndWorld.z },
    });

    // Garages Rear Wall & Side Walls collisions (protecting building structure)
    const garageBack1 = new THREE.Vector3(-32.0, 0, -48.0).applyMatrix4(pitGroup.matrixWorld);
    const garageBack2 = new THREE.Vector3(-32.0, 0, 48.0).applyMatrix4(pitGroup.matrixWorld);
    this.staticObstacles.push({
      x: (garageBack1.x + garageBack2.x) / 2,
      z: (garageBack1.z + garageBack2.z) / 2,
      radius: 49.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: garageBack1.x, z: garageBack1.z },
      p2: { x: garageBack2.x, z: garageBack2.z },
    });

    const garageSideS1 = new THREE.Vector3(-20.5, 0, -48.0).applyMatrix4(pitGroup.matrixWorld);
    const garageSideS2 = new THREE.Vector3(-32.0, 0, -48.0).applyMatrix4(pitGroup.matrixWorld);
    this.staticObstacles.push({
      x: (garageSideS1.x + garageSideS2.x) / 2,
      z: (garageSideS1.z + garageSideS2.z) / 2,
      radius: 7.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: garageSideS1.x, z: garageSideS1.z },
      p2: { x: garageSideS2.x, z: garageSideS2.z },
    });

    const garageSideN1 = new THREE.Vector3(-20.5, 0, 48.0).applyMatrix4(pitGroup.matrixWorld);
    const garageSideN2 = new THREE.Vector3(-32.0, 0, 48.0).applyMatrix4(pitGroup.matrixWorld);
    this.staticObstacles.push({
      x: (garageSideN1.x + garageSideN2.x) / 2,
      z: (garageSideN1.z + garageSideN2.z) / 2,
      radius: 7.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: garageSideN1.x, z: garageSideN1.z },
      p2: { x: garageSideN2.x, z: garageSideN2.z },
    });

    this.group.add(pitGroup);
  }

  private buildDoubleSidedSafetyBarriers(): void {
    const strip = buildC3SafetyStrip(SINGAPORE_WAYPOINTS);
    const walls = new THREE.Mesh(strip.walls, this.asphaltWallMat);
    walls.name = 'C3_ContinuousSafetyWalls';
    this.group.add(walls);
    for (const {p1, p2} of strip.segments) {
      this.staticObstacles.push({
        x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2,
        radius: Math.hypot(p2.x - p1.x, p2.z - p1.z) * 0.55,
        type: 'wall', isWallSegment: true, p1, p2,
      });
    }
    this.group.userData.c3SafetySegments = strip.segments.length;
  }

  /**
   * Encloses the outer perimeter of the exterior paddock complex (X = -39.0)
   * from Z = -135 to Z = +135 with end connectors joining the main track safety barriers.
   * Leaves the pit entry and pit exit ramps completely open for traffic.
   */
  private buildPitAccessPerimeterWalls(): void {
    const perimeterGroup = new THREE.Group();
    perimeterGroup.name = 'C3_PaddockPerimeterBarrier';
    perimeterGroup.position.set(687.89, 0, -108.18);
    perimeterGroup.rotation.y = -2.996;

    const wallHeight = 1.25;
    const wallThick = 0.8;
    const outerX = -39.0;
    const zMin = -135.0;
    const zMax = 135.0;
    const wallLen = zMax - zMin;

    // 1. Long Outer Longitudinal Barrier (X = -39.0, Z: -135 to +135)
    const longWallGeo = new THREE.BoxGeometry(wallThick, wallHeight, wallLen);
    tileC3BoxGeometryUvs(longWallGeo);
    const longWall = new THREE.Mesh(longWallGeo, this.asphaltWallMat);
    longWall.position.set(outerX, wallHeight / 2, (zMin + zMax) / 2);
    perimeterGroup.add(longWall);

    // 2. South Transverse Connector (Z = -135, from ramp outer edge X = -11.5 to outerX = -39.0)
    // Leaves pit entry deceleration ramp (X: -7.0 to -11.5) wide open for pit traffic
    const rampOuterX = -11.5;
    const southLen = Math.abs(outerX - rampOuterX);
    const southWallGeo = new THREE.BoxGeometry(southLen, wallHeight, wallThick);
    tileC3BoxGeometryUvs(southWallGeo);
    const southWall = new THREE.Mesh(southWallGeo, this.asphaltWallMat);
    southWall.position.set((rampOuterX + outerX) / 2, wallHeight / 2, zMin);
    perimeterGroup.add(southWall);

    // 3. North Transverse Connector (Z = +135, from ramp outer edge X = -11.5 to outerX = -39.0)
    // Leaves pit exit acceleration ramp (X: -7.0 to -11.5) wide open for track merge
    const northLen = Math.abs(outerX - rampOuterX);
    const northWallGeo = new THREE.BoxGeometry(northLen, wallHeight, wallThick);
    tileC3BoxGeometryUvs(northWallGeo);
    const northWall = new THREE.Mesh(northWallGeo, this.asphaltWallMat);
    northWall.position.set((rampOuterX + outerX) / 2, wallHeight / 2, zMax);
    perimeterGroup.add(northWall);

    // 4. Right-hand pit-exit enclosure: curve from the terminal pit-building wall
    // (local X = -20.5, Z = +48) to the exterior perimeter wall (local X = -39).
    // This only closes the paddock/right side; the pit-exit ramp remains unobstructed.
    const rightExitCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-21.5, 0, 48),
      new THREE.Vector3(-22.0, 0, 62),
      new THREE.Vector3(-24.0, 0, 77),
      new THREE.Vector3(-31.0, 0, 93),
      new THREE.Vector3(-39.0, 0, 108),
    ], false, 'centripetal');
    const rightExitPoints = rightExitCurve.getPoints(64);
    const rightExitPositions: number[] = [];
    const rightExitUvs: number[] = [];
    const rightExitIndices: number[] = [];
    let rightExitDistance = 0;
    for (let i = 0; i < rightExitPoints.length; i++) {
      if (i > 0) rightExitDistance += rightExitPoints[i].distanceTo(rightExitPoints[i - 1]);
      const before = rightExitPoints[Math.max(0, i - 1)];
      const after = rightExitPoints[Math.min(rightExitPoints.length - 1, i + 1)];
      const tangent = after.clone().sub(before).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const left = rightExitPoints[i].clone().addScaledVector(normal, wallThick / 2);
      const right = rightExitPoints[i].clone().addScaledVector(normal, -wallThick / 2);
      rightExitPositions.push(
        left.x, 0, left.z, left.x, wallHeight, left.z,
        right.x, 0, right.z, right.x, wallHeight, right.z,
      );
      const u = rightExitDistance / 3;
      const across = wallThick / 3;
      rightExitUvs.push(u, 0, u, wallHeight / 3, u + across, 0, u + across, wallHeight / 3);
      if (i === 0) continue;
      const current = i * 4;
      const previous = current - 4;
      // Two wall faces, top, and bottom for each curved segment.
      rightExitIndices.push(
        previous, current, previous + 1, current, current + 1, previous + 1,
        previous + 2, previous + 3, current + 2, previous + 3, current + 3, current + 2,
        previous + 1, current + 1, previous + 3, current + 1, current + 3, previous + 3,
        previous, previous + 2, current, previous + 2, current + 2, current,
      );
    }
    const startCap = [0, 1, 2, 1, 3, 2];
    const endCapBase = (rightExitPoints.length - 1) * 4;
    rightExitIndices.push(
      ...startCap,
      endCapBase, endCapBase + 2, endCapBase + 1,
      endCapBase + 2, endCapBase + 3, endCapBase + 1,
    );
    const rightExitGeo = new THREE.BufferGeometry();
    rightExitGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightExitPositions, 3));
    rightExitGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rightExitUvs, 2));
    rightExitGeo.setIndex(rightExitIndices);
    rightExitGeo.computeVertexNormals();
    rightExitGeo.computeBoundingBox();
    rightExitGeo.computeBoundingSphere();
    const rightExitWall = new THREE.Mesh(rightExitGeo, this.asphaltWallMat);
    rightExitWall.name = 'C3_PitExitRightCurvedBarrier';
    perimeterGroup.add(rightExitWall);

    perimeterGroup.updateMatrixWorld(true);

    // Register physical wall collision segments
    const pLong1 = new THREE.Vector3(outerX, 0, zMin).applyMatrix4(perimeterGroup.matrixWorld);
    const pLong2 = new THREE.Vector3(outerX, 0, zMax).applyMatrix4(perimeterGroup.matrixWorld);
    this.staticObstacles.push({
      x: (pLong1.x + pLong2.x) / 2,
      z: (pLong1.z + pLong2.z) / 2,
      radius: wallLen / 2 + 1.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: pLong1.x, z: pLong1.z },
      p2: { x: pLong2.x, z: pLong2.z },
    });

    const pSouth1 = new THREE.Vector3(-7.0, 0, zMin).applyMatrix4(perimeterGroup.matrixWorld);
    const pSouth2 = new THREE.Vector3(outerX, 0, zMin).applyMatrix4(perimeterGroup.matrixWorld);
    this.staticObstacles.push({
      x: (pSouth1.x + pSouth2.x) / 2,
      z: (pSouth1.z + pSouth2.z) / 2,
      radius: southLen / 2 + 1.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: pSouth1.x, z: pSouth1.z },
      p2: { x: pSouth2.x, z: pSouth2.z },
    });

    const pNorth1 = new THREE.Vector3(-7.0, 0, zMax).applyMatrix4(perimeterGroup.matrixWorld);
    const pNorth2 = new THREE.Vector3(outerX, 0, zMax).applyMatrix4(perimeterGroup.matrixWorld);
    this.staticObstacles.push({
      x: (pNorth1.x + pNorth2.x) / 2,
      z: (pNorth1.z + pNorth2.z) / 2,
      radius: northLen / 2 + 1.0,
      type: 'wall',
      isWallSegment: true,
      p1: { x: pNorth1.x, z: pNorth1.z },
      p2: { x: pNorth2.x, z: pNorth2.z },
    });

    for (let i = 0; i < rightExitPoints.length - 1; i++) {
      const p1 = rightExitPoints[i].clone().applyMatrix4(perimeterGroup.matrixWorld);
      const p2 = rightExitPoints[i + 1].clone().applyMatrix4(perimeterGroup.matrixWorld);
      this.staticObstacles.push({
        x: (p1.x + p2.x) / 2,
        z: (p1.z + p2.z) / 2,
        radius: Math.hypot(p2.x - p1.x, p2.z - p1.z) / 2 + wallThick / 2,
        type: 'wall',
        isWallSegment: true,
        p1: { x: p1.x, z: p1.z },
        p2: { x: p2.x, z: p2.z },
      });
    }

    this.group.add(perimeterGroup);
  }

  private buildInstancedStadiumFloodlights(): void {
    const floodlights = buildC3FloodlightRig(
      SINGAPORE_WAYPOINTS,
      this.halfWidth,
      this.floodlightPoleMat,
      this.concreteBarrierMat,
    );
    this.group.add(floodlights);
    this.group.userData.c3FloodlightDesign = floodlights.userData.c3FloodlightDesign;
  }

  private buildBrakingDistanceBoards(): void {
    // Braking distance boards placed strictly behind catch barriers (> 10.5m from centerline)
    const boards = [
      // Turn 1 Braking (Sheares approach, outside right)
      { x: 674.2, z: -274.7, text: '150', rot: -3.00 },
      { x: 667.6, z: -319.7, text: '100', rot: -3.00 },
      { x: 660.0, z: -372.2, text: '50', rot: -3.00 },
      // Turn 7 Braking (Memorial Corner, outside right)
      { x: -90.6, z: -193.2, text: '150', rot: -2.08 },
      { x: -137.0, z: -218.8, text: '100', rot: -2.08 },
      { x: -176.8, z: -240.8, text: '50', rot: -2.08 },
      // Turn 14 Braking (Raffles Avenue, outside left)
      { x: -409.7, z: 114.7, text: '100', rot: 2.86 },
      { x: -395.4, z: 70.7, text: '50', rot: 2.79 },
    ];

    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6);
    const panelGeo = new THREE.BoxGeometry(1.6, 1.0, 0.12);
    const postsInst = new THREE.InstancedMesh(postGeo, this.floodlightPoleMat, boards.length);
    const panelsInst = new THREE.InstancedMesh(panelGeo, this.kerbWhiteMat, boards.length);
    postsInst.name = 'C3_BrakingPostsInstanced';
    panelsInst.name = 'C3_BrakingPanelsInstanced';

    const dummy = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const localPost = new THREE.Matrix4().makeTranslation(0, 1.1, 0);
    const localPanel = new THREE.Matrix4().makeTranslation(0, 2.2, 0);

    boards.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      tempMatrix.multiplyMatrices(dummy.matrix, localPost);
      postsInst.setMatrixAt(i, tempMatrix);

      tempMatrix.multiplyMatrices(dummy.matrix, localPanel);
      panelsInst.setMatrixAt(i, tempMatrix);
    });

    postsInst.instanceMatrix.needsUpdate = true;
    panelsInst.instanceMatrix.needsUpdate = true;
    this.group.add(postsInst, panelsInst);
  }

  public impartImpulseToProp(prop: DynamicProp, vel: THREE.Vector3, normal: THREE.Vector3): void {
    prop.isSleeping = false;
    prop.isAirborne = true;
    prop.airborneTimer = 0;
    const impactSpeed = vel.length();
    const impulseStrength = Math.min(32, Math.max(6, impactSpeed * 1.4));

    prop.velocity.x = normal.x * impulseStrength + vel.x * 0.45;
    prop.velocity.z = normal.z * impulseStrength + vel.z * 0.45;
    prop.velocity.y = Math.min(12, 5.0 + Math.random() * 3.5);

    prop.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  }

  public updateDynamicProps(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.mesh === this.ferrisWheelRimGroup) continue;

      if (!prop.prevPosition) prop.prevPosition = prop.position.clone();
      if (!prop.prevRotation) prop.prevRotation = prop.rotation.clone();
      if (prop.isSleeping) continue;

      prop.prevPosition.copy(prop.position);
      prop.prevRotation.copy(prop.rotation);

      if (prop.isAirborne) {
        prop.airborneTimer = (prop.airborneTimer || 0) + dt;
        if (prop.airborneTimer > 2.0) {
          const fadeProgress = (prop.airborneTimer - 2.0) / 0.8;
          const scale = Math.max(0, 1 - fadeProgress);
          prop.mesh.scale.set(scale, scale, scale);
        }
        if (prop.airborneTimer >= 2.8) {
          prop.mesh.visible = false;
          prop.mesh.scale.set(0.001, 0.001, 0.001);
          prop.isSleeping = true;
          prop.velocity.set(0, 0, 0);
          prop.angularVelocity.set(0, 0, 0);
          continue;
        }
      }

      prop.position.addScaledVector(prop.velocity, dt);
      prop.velocity.y -= 19.6 * dt;
      prop.rotation.addScaledVector(prop.angularVelocity, dt);

      if (prop.position.y <= prop.baseY) {
        prop.position.y = prop.baseY;
        prop.velocity.y *= -0.32;
        prop.velocity.x *= 0.65;
        prop.velocity.z *= 0.65;
        prop.angularVelocity.multiplyScalar(0.7);

        if (prop.velocity.lengthSq() < 0.25) {
          prop.isSleeping = true;
          prop.velocity.set(0, 0, 0);
          prop.angularVelocity.set(0, 0, 0);
        }
      }
    }
  }

  /** Visual-only animation; called once per rendered frame, not per physics substep. */
  public updateVisualDynamicProps(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.cinematicAtmosphere?.update(dt);
    this.waterSurface?.update(dt);
    const oceanMaterial = this.waterSurface?.mesh.material as THREE.ShaderMaterial | undefined;
    this.maritimeFleet?.update(dt, oceanMaterial?.uniforms.time.value, oceanMaterial?.uniforms.uWaveStrength.value);
    this.dutchShip?.update(dt, oceanMaterial?.uniforms.time.value, oceanMaterial?.uniforms.uWaveStrength.value);
    this.ferrisWheel?.update(dt);
    if (!this.ferrisWheelRimGroup) return;
    this.ferrisWheelRimGroup.rotation.z = (this.ferrisWheelRimGroup.rotation.z + 0.04 * Math.min(dt, 0.1)) % (Math.PI * 2);
    for (const child of this.ferrisWheelRimGroup.children) {
      if (child.name === 'C3_FlyerCapsule') {
        child.rotation.z = -this.ferrisWheelRimGroup.rotation.z;
        child.updateMatrix();
      }
    }
  }

  /** Keep shadow casters in a local bubble around the car. Visible meshes and
   * collision geometry remain untouched; only their shadow-map participation
   * is changed. Large track ribbons stay eligible when their bounds overlap
   * the bubble. */
  public updateNearbyShadowCasters(center: THREE.Vector3, radius = 150): void {
    const list = this.shadowCasterMeshes;
    for (let i = 0; i < list.length; i++) {
      const obj = list[i];
      const geometry = obj.geometry;
      if (!geometry.boundingSphere) continue;
      _shadowSphere.copy(geometry.boundingSphere).applyMatrix4(obj.matrixWorld);
      _shadowCenterWorld.copy(_shadowSphere.center);
      const maxRadius = _shadowSphere.radius;
      const distanceSq = _shadowCenterWorld.distanceToSquared(center);
      const threshold = radius + maxRadius;
      obj.castShadow = distanceSq <= threshold * threshold || obj.userData.c3ShadowAlways === true;
    }
  }

  public syncDynamicPropsVisuals(alpha: number): void {
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.mesh === this.ferrisWheelRimGroup) continue;
      if (prop.isSleeping || !prop.prevPosition || !prop.prevRotation) continue;

      prop.mesh.position.lerpVectors(prop.prevPosition, prop.position, alpha);
      prop.mesh.rotation.x = THREE.MathUtils.lerp(prop.prevRotation.x, prop.rotation.x, alpha);
      prop.mesh.rotation.y = THREE.MathUtils.lerp(prop.prevRotation.y, prop.rotation.y, alpha);
      prop.mesh.rotation.z = THREE.MathUtils.lerp(prop.prevRotation.z, prop.rotation.z, alpha);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.cinematicAtmosphere?.dispose();
    this.waterSurface?.dispose();
    // Detaches the fleet before generic track disposal, avoiding duplicate
    // disposal of shared boat materials / textures / BatchedMesh buffers.
    this.maritimeFleet?.dispose();
    this.maritimeFleet = undefined;
    this.dutchShip?.dispose();
    this.dutchShip = undefined;
    this.gothicStatue?.dispose();
    this.gothicStatue = undefined;
    // The landmark owns its instance buffers and packed transparent geometry.
    this.ferrisWheel?.dispose();
    this.ferrisWheel = undefined;
    this.crowdSystem.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.group.traverse((obj) => {
      // Instanced matrix/color buffers are object-owned, not geometry-owned.
      if (obj instanceof THREE.InstancedMesh) obj.dispose();
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) geometries.add(obj.geometry);
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      }
    });
    // All C3 maps are track-owned; cached PBR originals remain alive for other
    // circuits. Deduplicate shared resources per disposal.
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.group.clear();
    this.staticObstacles.length = 0;
    this.dynamicProps.length = 0;
  }
}
