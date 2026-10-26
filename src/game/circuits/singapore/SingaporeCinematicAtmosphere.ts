/**
 * SingaporeCinematicAtmosphere.ts - Cinematic Sky, Sun & Cloud System for Circuit 3
 * Integrated from PELAGIC Three.js Sky & Ocean Architecture.
 *
 * Technical Specifications:
 * 1. Physical Rayleigh & Mie Atmospheric Scattering Sky (Three.js Sky addon).
 * 2. 6-octave multi-scale procedural noise atlas for cloud advection (DataTexture generated on CPU).
 * 3. Dual-band volumetric-look cloud shader (low stratus + high cirrus) with texture-space advection warping.
 * 4. Analytical solar halo (wide golden aureole + warm incandescent core) blending into atmosphere.
 * 5. Co-aligned directional golden sunlight (0xffbd86, 2.6) and cool sky bounce hemisphere light (0x9ccbd7 / 0x06131d).
 * 6. Continuous camera centering to eliminate horizon cutoff and perspective distortion.
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createC3SelectiveBloom, type C3SelectiveBloom } from './SingaporeSelectiveBloom';
import { createC3TrackFloodlights, type C3TrackFloodlights } from './SingaporeTrackFloodlights';
import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';

/**
 * Builds a tileable multi-scale noise atlas once on CPU.
 * Sampling this texture in shader is far cheaper than per-pixel 3D noise hashes.
 */
function createCloudNoiseTexture(width = 512, height = 256): THREE.DataTexture {
  let seed = 0x37c4a91;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const grids = [
    { w: 4, h: 3 },
    { w: 8, h: 5 },
    { w: 16, h: 10 },
    { w: 32, h: 20 },
    { w: 64, h: 40 },
    { w: 128, h: 80 },
  ].map((g) => ({ ...g, data: Float32Array.from({ length: g.w * g.h }, random) }));

  const smooth01 = (x: number) => x * x * (3 - 2 * x);

  function sampleGrid(g: { w: number; h: number; data: Float32Array }, u: number, v: number): number {
    u -= Math.floor(u);
    v -= Math.floor(v);
    const x = u * g.w, y = v * g.h;
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth01(x - ix), fy = smooth01(y - iy);
    const x0 = ix % g.w, x1 = (ix + 1) % g.w;
    const y0 = iy % g.h, y1 = (iy + 1) % g.h;
    const a = g.data[y0 * g.w + x0], b = g.data[y0 * g.w + x1];
    const c = g.data[y1 * g.w + x0], d = g.data[y1 * g.w + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const n0 = sampleGrid(grids[0], u, v), n1 = sampleGrid(grids[1], u, v);
      const n2 = sampleGrid(grids[2], u, v), n3 = sampleGrid(grids[3], u, v);
      const n4 = sampleGrid(grids[4], u, v), n5 = sampleGrid(grids[5], u, v);

      const r = n0 * 0.45 + n1 * 0.26 + n2 * 0.15 + n3 * 0.08 + n4 * 0.06;
      const g = n1 * 0.04 + n2 * 0.13 + n3 * 0.24 + n4 * 0.30 + n5 * 0.29;
      const b = n2 * 0.06 + n3 * 0.18 + n4 * 0.31 + n5 * 0.45;

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r * 255);
      data[idx + 1] = Math.round(g * 255);
      data[idx + 2] = Math.round(b * 255);
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const CLOUD_VERTEX_SHADER = /* glsl */`
  varying vec3 vCloudDir;
  void main() {
    vCloudDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform sampler2D uCloudNoise;
  varying vec3 vCloudDir;

  const float PI = 3.141592653589793;

  void main() {
    vec3 d = normalize(vCloudDir);
    float elevation = asin(clamp(d.y, -1.0, 1.0));
    float longitude = atan(d.z, d.x) / (2.0 * PI) + 0.5;
    vec2 uv = vec2(fract(longitude), clamp((elevation + 0.12) / 0.72, 0.0, 1.0));

    // Slow advection and texture-space warping break the tiled look without expensive per-pixel 3D noise
    vec4 warp = texture2D(uCloudNoise, uv * vec2(0.82, 1.12) + vec2(uTime * 0.0016, 0.17 - uTime * 0.0003));
    vec2 warpedUV = uv + (warp.rg - 0.5) * vec2(0.105, 0.046) + vec2(-uTime * 0.0017, 0.0);
    vec4 cloudA = texture2D(uCloudNoise, warpedUV + vec2(uTime * 0.0015, 0.0));
    vec4 cloudB = texture2D(uCloudNoise, warpedUV * vec2(2.15, 1.7) + vec2(-uTime * 0.0022, 0.31));

    float lowDensity = cloudA.r * 0.76 + cloudB.g * 0.24;
    float lowShape = smoothstep(0.455, 0.665, lowDensity);
    float lowBand = smoothstep(-0.060, -0.012, elevation) * (1.0 - smoothstep(0.115, 0.195, elevation));
    float lowAlpha = lowShape * lowBand * 0.50;

    vec4 highA = texture2D(uCloudNoise, warpedUV * vec2(2.35, 3.1) + vec2(-uTime * 0.0031, 0.43));
    float highDensity = highA.b * 0.78 + highA.g * 0.22;
    float cirrusShape = smoothstep(0.475, 0.700, highDensity) * smoothstep(0.31, 0.59, highA.g);
    float highBand = smoothstep(0.125, 0.17, elevation) * (1.0 - smoothstep(0.31, 0.39, elevation));
    float highAlpha = cirrusShape * highBand * 0.13;
    float cloudsAlpha = lowAlpha + highAlpha * (1.0 - lowAlpha);

    vec3 sunDir = normalize(uSunDirection);
    float sunDot = clamp(dot(d, sunDir), -1.0, 1.0);
    float angularDistance = sqrt(max(0.0, 2.0 * (1.0 - sunDot)));

    // Wide aureole and tighter warm core make the low sun blend into the atmosphere
    float haloWide = exp(-angularDistance * 5.2);
    float haloCore = exp(-angularDistance * 18.0);
    float glowAlpha = clamp(haloWide * 0.20 + haloCore * 0.13, 0.0, 0.30);
    vec3 glowColor = mix(vec3(1.13, 0.39, 0.19), vec3(1.42, 0.88, 0.59), smoothstep(0.005, 0.17, angularDistance));

    float sunward = smoothstep(-0.30, 0.62, sunDot);
    vec3 cloudShadow = mix(vec3(0.105, 0.145, 0.225), vec3(0.285, 0.205, 0.235), sunward * 0.82);
    vec3 cloudLit = mix(vec3(0.42, 0.46, 0.58), vec3(1.14, 0.69, 0.44), sunward);
    float cloudTop = smoothstep(0.50, 0.76, lowDensity);
    vec3 lowColor = mix(cloudShadow, cloudLit, 0.24 + 0.72 * cloudTop);
    vec3 highColor = mix(vec3(0.34, 0.39, 0.52), vec3(0.96, 0.70, 0.56), sunward * 0.72);
    highColor *= 0.78 + 0.28 * smoothstep(0.51, 0.77, highDensity);
    vec3 cloudsColor = (lowColor * lowAlpha + highColor * highAlpha * (1.0 - lowAlpha)) / max(cloudsAlpha, 0.0001);

    vec3 premul = cloudsColor * cloudsAlpha + glowColor * glowAlpha * (1.0 - cloudsAlpha);
    float alpha = cloudsAlpha + glowAlpha * (1.0 - cloudsAlpha);
    if (alpha < 0.006) discard;

    gl_FragColor = vec4(premul / max(alpha, 0.0001), clamp(alpha, 0.0, 0.76));
  }
`;

export class SingaporeCinematicAtmosphere {
  public readonly diagnostics = {
    active: false,
    renders: 0,
    exposure: 1.0,
    keyIntensity: 2.6,
    fillIntensity: 0.45,
    preset: 'Cinematic Ocean Golden Hour',
  };

  private readonly sky: Sky;
  private readonly cloudDome: THREE.Mesh;
  private readonly cloudMaterial: THREE.ShaderMaterial;
  private readonly cloudNoise: THREE.DataTexture;
  private readonly bloom: C3SelectiveBloom;
  private readonly trackLighting: C3TrackFloodlights;

  private scene?: THREE.Scene;
  private previousBefore?: THREE.Scene['onBeforeRender'];
  private previousAfter?: THREE.Scene['onAfterRender'];
  private readonly depth = { value: 0 };
  private time = 0;
  private disposed = false;

  private dirLight?: THREE.DirectionalLight;
  private hemiLight?: THREE.HemisphereLight;
  private readonly sunDirection = new THREE.Vector3();
  private readonly cameraWorld = new THREE.Vector3();

  private readonly before: THREE.Scene['onBeforeRender'] = (...args) => {
    if (this.depth.value++ > 0) return;
    try {
      if (args[2]) this.apply(args[0], args[2] as THREE.Camera);
      this.previousBefore?.apply(this.scene!, args);
    } catch (e) {
      this.depth.value = 0;
      throw e;
    }
  };

  private readonly after: THREE.Scene['onAfterRender'] = (...args) => {
    if (this.depth.value === 0 || --this.depth.value > 0) return;
    const renderer = args[0];
    try {
      if (renderer.getRenderTarget() === null && this.root.userData.c3BloomEnabled !== false) {
        this.bloom.render(renderer, this.root.userData.c3Quality ?? 'low');
      }
    } finally {
      this.diagnostics.renders++;
    }
    this.previousAfter?.apply(this.scene!, args);
  };

  constructor(
    private readonly root: THREE.Group,
    private readonly onQuality?: (quality: 'low' | 'medium' | 'high') => void,
  ) {
    // 1. Physically-tuned low golden-hour sun
    const sunElevation = 10.5;
    const sunAzimuth = 157.0;
    const phi = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);
    this.sunDirection.setFromSphericalCoords(1, phi, theta).normalize();

    // 2. Physical Rayleigh & Mie Atmospheric Scattering Sky
    this.sky = new Sky();
    this.sky.name = 'C3_AtmosphericSky';
    this.sky.scale.setScalar(9000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10000;

    const skyUniforms = this.sky.material.uniforms;
    skyUniforms.turbidity.value = 5.6;
    skyUniforms.rayleigh.value = 1.9;
    skyUniforms.mieCoefficient.value = 0.0031;
    skyUniforms.mieDirectionalG.value = 0.82;
    skyUniforms.sunPosition.value.copy(this.sunDirection);
    this.sky.layers.enable(1);
    this.root.add(this.sky);

    // 3. Procedural Cinematic Clouds with Advection & Halo
    this.cloudNoise = createCloudNoiseTexture(512, 256);
    this.cloudMaterial = new THREE.ShaderMaterial({
      name: 'C3_CinematicCloudMaterial',
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.sunDirection.clone() },
        uCloudNoise: { value: this.cloudNoise },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      blending: THREE.NormalBlending,
    });

    this.cloudDome = new THREE.Mesh(new THREE.SphereGeometry(8200, 64, 48), this.cloudMaterial);
    this.cloudDome.name = 'C3_CloudDome';
    this.cloudDome.frustumCulled = false;
    this.cloudDome.renderOrder = 1;
    this.cloudDome.layers.enable(1);
    this.root.add(this.cloudDome);

    // 4. Post-processing & Lighting Subsystems
    this.bloom = createC3SelectiveBloom();
    this.trackLighting = createC3TrackFloodlights(root, SINGAPORE_WAYPOINTS, 7);
    this.trackLighting.setIntensity(0.0); // Daylight sun provides full illumination

    root.userData.c3Bloom = this.bloom.diagnostics;
    root.userData.c3Environment = {
      preset: 'PELAGIC Cinematic Ocean Golden Hour',
      sunElevationDegrees: sunElevation,
      sunAzimuthDegrees: sunAzimuth,
    };

    root.addEventListener('added', () => {
      if (this.root.parent instanceof THREE.Scene) this.attach(this.root.parent);
    });
    root.addEventListener('removed', () => this.detach());

    if (root.parent instanceof THREE.Scene) {
      this.attach(root.parent);
    }
  }

  public update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.disposed) return;
    this.time += Math.min(dt, 0.1);
    this.cloudMaterial.uniforms.uTime.value = this.time;
  }

  private attach(scene: THREE.Scene): void {
    if (this.scene === scene || this.disposed) return;
    this.detach();
    this.scene = scene;
    this.previousBefore = scene.onBeforeRender;
    this.previousAfter = scene.onAfterRender;
    scene.onBeforeRender = this.before;
    scene.onAfterRender = this.after;
    this.diagnostics.active = true;

    // Cache light references once on attach to eliminate expensive scene.traverse in render loop
    this.dirLight = undefined;
    this.hemiLight = undefined;
    scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight && (obj.castShadow || obj.userData.c3PrimarySun)) {
        this.dirLight = obj;
      } else if (obj instanceof THREE.HemisphereLight) {
        this.hemiLight = obj;
      }
    });

    // Distant subtle coastal horizon mist that does not darken track or scenery
    scene.fog = new THREE.Fog(0x93abb5, 2500, 9500);
  }

  private apply(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    camera.getWorldPosition(this.cameraWorld);

    // Center sky and cloud dome continuously on camera
    this.sky.position.copy(this.cameraWorld);
    this.sky.updateMatrix();
    this.cloudDome.position.copy(this.cameraWorld);
    this.cloudDome.updateMatrix();

    // Cinematic ACES Filmic exposure
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.diagnostics.exposure;

    // Direct and ambient lighting synchronization via cached references (zero scene traversal overhead)
    if (this.dirLight) {
      this.dirLight.color.setHex(0xffbd86);
      this.dirLight.intensity = this.diagnostics.keyIntensity;
      this.dirLight.position.copy(this.cameraWorld).addScaledVector(this.sunDirection, 220);
      this.dirLight.target.position.copy(this.cameraWorld);
      this.dirLight.target.updateMatrixWorld(true);
      this.dirLight.updateMatrixWorld(true);
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(0x9ccbd7); // Cool oceanic sky bounce
      this.hemiLight.groundColor.setHex(0x06131d); // Deep seabed absorption
      this.hemiLight.intensity = this.diagnostics.fillIntensity;
    }

    const quality = (this.root.userData.c3Quality as 'low' | 'medium' | 'high') ?? 'high';
    this.trackLighting.update(camera, quality);
    this.onQuality?.(quality);
  }

  private detach(): void {
    if (this.scene) {
      if (this.scene.onBeforeRender === this.before) this.scene.onBeforeRender = this.previousBefore!;
      if (this.scene.onAfterRender === this.after) this.scene.onAfterRender = this.previousAfter!;
    }
    this.scene = undefined;
    this.previousBefore = undefined;
    this.previousAfter = undefined;
    this.diagnostics.active = false;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.detach();
    this.disposed = true;
    this.bloom.dispose();
    this.trackLighting.dispose();
    this.cloudNoise.dispose();
    this.cloudMaterial.dispose();
    this.cloudDome.geometry.dispose();
    this.sky.material.dispose();
    this.sky.geometry.dispose();
  }
}
